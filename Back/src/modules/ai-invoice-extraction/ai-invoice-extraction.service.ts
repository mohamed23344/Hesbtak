import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import { AccountingService } from '../accounting/accounting.service';
import { TenantContext } from '../tenant/tenant.service';
import {
  ConfirmInvoiceExtractionDto,
  ConfirmPartyDto,
  InvoiceSection,
} from './dto';
import {
  INVOICE_EXTRACTION_JSON_SCHEMA,
  invoiceExtractionPrompt,
} from './invoice-extraction.prompt';

type UploadedInvoice = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

type ExtractedDraft = {
  party: {
    id: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  issueDate: string | null;
  dueDate: string | null;
  status: 'draft' | 'open' | 'paid' | null;
  paymentMethod: 'cash' | 'bank' | 'card' | 'transfer' | null;
  lines: Array<{
    description: string | null;
    quantity: number | null;
    unitPrice: number | null;
    discountAmount: number | null;
    taxRate: number | null;
  }>;
};

const MODEL = 'Qwen/Qwen3-VL-235B-A22B-Instruct';
const PROVIDER = 'novita';
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class AiInvoiceExtractionService {
  constructor(
    private readonly config: ConfigService,
    private readonly accounting: AccountingService,
  ) {}

  async extract(
    ctx: TenantContext,
    section: InvoiceSection,
    file?: UploadedInvoice,
  ) {
    if (!['sales', 'purchases', 'expenses'].includes(section)) {
      throw new BadRequestException('Invalid invoice section');
    }
    this.validateFile(file);
    const token =
      this.config.get<string>('HF_TOKEN') ?? process.env.HF_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException(
        'HF_TOKEN is required for invoice OCR extraction',
      );
    }

    const client = new InferenceClient(token);
    const dataUrl = `data:${file!.mimetype};base64,${file!.buffer.toString('base64')}`;

    try {
      const response = await client.chatCompletion({
        provider: PROVIDER,
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You extract invoice data for an ERP. Return strict JSON only.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: invoiceExtractionPrompt(section) },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 3000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'invoice_extraction',
            strict: true,
            schema: INVOICE_EXTRACTION_JSON_SCHEMA,
          },
        },
      });

      const content = response.choices[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new BadGatewayException('The invoice model returned no data');
      }

      const draft = this.normalizeDraft(this.parseJson(content));
      draft.party.id = await this.matchParty(ctx, section, draft.party.name);

      return {
        model: `${MODEL}:${PROVIDER}`,
        fileName: file!.originalname,
        section,
        draft,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      throw new BadGatewayException(
        error instanceof Error
          ? `Invoice extraction failed: ${error.message}`
          : 'Invoice extraction failed',
      );
    }
  }

  async confirm(
    ctx: TenantContext,
    userId: string,
    dto: ConfirmInvoiceExtractionDto,
  ) {
    const partyId = await this.resolveParty(ctx, userId, dto.section, dto.party);
    const lines = dto.lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      discountAmount: Number(line.discountAmount ?? 0),
      taxRate: Number(line.taxRate ?? 0),
      accountId: line.accountId,
    }));

    if (dto.section === 'sales') {
      return this.accounting.createInvoice(ctx, userId, {
        customerId: partyId,
        issueDate: dto.issueDate,
        dueDate: dto.dueDate,
        status: dto.status === 'open' ? 'unpaid' : dto.status,
        paymentMethod: dto.paymentMethod,
        lines,
      });
    }

    return this.accounting.createVendorBill(ctx, userId, {
      vendorId: partyId,
      issueDate: dto.issueDate,
      dueDate: dto.dueDate,
      status: dto.status === 'open' ? 'received' : dto.status,
      paymentMethod: dto.paymentMethod,
      lines,
    });
  }

  private validateFile(file?: UploadedInvoice): asserts file is UploadedInvoice {
    if (!file) throw new BadRequestException('Invoice image is required');
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WebP invoice images are supported');
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Invoice image must be 10 MB or smaller');
    }
  }

  private parseJson(content: string): unknown {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new BadGatewayException('The invoice model returned invalid JSON');
    }
  }

  private normalizeDraft(value: unknown): ExtractedDraft {
    const raw = (value && typeof value === 'object' ? value : {}) as Record<
      string,
      unknown
    >;
    const rawParty =
      raw.party && typeof raw.party === 'object'
        ? (raw.party as Record<string, unknown>)
        : {};
    const rawLines = Array.isArray(raw.lines) ? raw.lines : [];

    return {
      party: {
        id: null,
        name: this.stringOrNull(rawParty.name),
        email: this.stringOrNull(rawParty.email),
        phone: this.stringOrNull(rawParty.phone),
        address: this.stringOrNull(rawParty.address),
      },
      issueDate: this.dateOrNull(raw.issueDate),
      dueDate: this.dateOrNull(raw.dueDate),
      status: this.enumOrNull(raw.status, ['draft', 'open', 'paid']),
      paymentMethod: this.enumOrNull(raw.paymentMethod, [
        'cash',
        'bank',
        'card',
        'transfer',
      ]),
      lines: rawLines.map((value) => {
        const line =
          value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : {};
        return {
          description: this.stringOrNull(line.description),
          quantity: this.numberOrNull(line.quantity),
          unitPrice: this.numberOrNull(line.unitPrice),
          discountAmount: this.numberOrNull(line.discountAmount),
          taxRate: this.numberOrNull(line.taxRate),
        };
      }),
    };
  }

  private async matchParty(
    ctx: TenantContext,
    section: InvoiceSection,
    name: string | null,
  ) {
    if (!name) return null;
    const parties =
      section === 'sales'
        ? await this.accounting.listCustomers(ctx)
        : await this.accounting.listVendors(ctx);
    const normalized = name.trim().toLocaleLowerCase();
    const match = (parties as Array<{ id: string; name: string }>).find(
      (party) => party.name.trim().toLocaleLowerCase() === normalized,
    );
    return match?.id ?? null;
  }

  private async resolveParty(
    ctx: TenantContext,
    userId: string,
    section: InvoiceSection,
    party: ConfirmPartyDto,
  ) {
    if (party.id) return party.id;
    if (!party.name?.trim()) {
      throw new BadRequestException(
        `${section === 'sales' ? 'Customer' : 'Vendor'} is required`,
      );
    }
    const data = {
      name: party.name.trim(),
      email: party.email,
      phone: party.phone,
      address: party.address,
    };
    const created =
      section === 'sales'
        ? await this.accounting.createCustomer(ctx, userId, data)
        : await this.accounting.createVendor(ctx, userId, data);
    return created.id;
  }

  private stringOrNull(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private dateOrNull(value: unknown) {
    const date = this.stringOrNull(value);
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  }

  private numberOrNull(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private enumOrNull<T extends string>(value: unknown, allowed: readonly T[]) {
    return typeof value === 'string' && allowed.includes(value as T)
      ? (value as T)
      : null;
  }
}
