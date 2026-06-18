import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataBaseService } from '../../database/database.service';
import { TenantContext, TenantService } from '../tenant/tenant.service';
import {
  getLlmClient,
  hasLlmConfiguration,
  LLM_MODELS,
} from '../ai/langgraph/config/llm.config';

export type RevenueAccountClassification = {
  accountId: string;
  code: string;
  name: string;
  confidence: number;
  reason: string;
  alternatives: Array<{
    accountId: string;
    code: string;
    name: string;
  }>;
};

type RevenueAccount = {
  id: string;
  code: string;
  name: string;
  parent_code: string | null;
  parent_name: string | null;
};

@Injectable()
export class RevenueAccountAgent {
  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
    private readonly config: ConfigService,
  ) {}

  async classify(
    ctx: TenantContext,
    invoiceLines: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>,
  ): Promise<RevenueAccountClassification> {
    const accounts = await this.availableRevenueAccounts(ctx);
    if (!accounts.length) {
      throw new BadRequestException(
        'Add at least one active revenue account before creating a sales invoice',
      );
    }
    if (accounts.length === 1) {
      return {
        accountId: accounts[0].id,
        code: accounts[0].code,
        name: accounts[0].name,
        confidence: 1,
        reason: 'This is the only available revenue account.',
        alternatives: [],
      };
    }
    if (!hasLlmConfiguration(this.config)) {
      throw new ServiceUnavailableException(
        'Revenue account classification requires an AI provider configuration',
      );
    }

    const organization = await this.db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { industry: true },
    });
    const client = getLlmClient(this.config);
    const response = await client.chat.completions.create({
      model: LLM_MODELS.REVENUE_ACCOUNT_AGENT,
      messages: [
        {
          role: 'system',
          content: `You are a senior accountant and chart-of-accounts classification specialist.
Analyze the invoice lines and select the most appropriate revenue account.

Rules:
- Select ONLY an accountId from Available Revenue Accounts.
- Never invent account IDs, codes, or names.
- Prefer the most specific account.
- Use the business type when descriptions are ambiguous.
- Provide alternatives only when confidence is low.
- Return valid JSON only with this shape:
{"accountId":"uuid","confidence":0.0,"reason":"short explanation","alternativeAccountIds":["uuid"]}`,
        },
        {
          role: 'user',
          content: `Business Type:
${organization?.industry ?? 'Not specified'}

Invoice Lines:
${JSON.stringify(invoiceLines)}

Available Revenue Accounts:
${JSON.stringify(accounts)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new BadGatewayException(
        'Revenue account classifier returned no result',
      );
    }
    const result = this.parseResult(content);
    const selected = accounts.find((account) => account.id === result.accountId);
    if (!selected) {
      throw new BadGatewayException(
        'Revenue account classifier selected an unavailable account',
      );
    }
    const alternatives = result.alternativeAccountIds
      .filter((id) => id !== selected.id)
      .map((id) => accounts.find((account) => account.id === id))
      .filter((account): account is RevenueAccount => Boolean(account))
      .slice(0, 3)
      .map((account) => ({
        accountId: account.id,
        code: account.code,
        name: account.name,
      }));

    return {
      accountId: selected.id,
      code: selected.code,
      name: selected.name,
      confidence: Math.max(0, Math.min(1, result.confidence)),
      reason: result.reason,
      alternatives,
    };
  }

  async selected(
    ctx: TenantContext,
    accountId: string,
  ): Promise<RevenueAccountClassification> {
    const accounts = await this.availableRevenueAccounts(ctx);
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account) {
      throw new BadRequestException(
        'Select an active leaf revenue account from the Chart of Accounts',
      );
    }
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      confidence: 1,
      reason: 'Selected by the user.',
      alternatives: [],
    };
  }

  private async availableRevenueAccounts(
    ctx: TenantContext,
  ): Promise<RevenueAccount[]> {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe<RevenueAccount[]>(
      `SELECT account.id, account.code, account.name,
              parent.code AS parent_code, parent.name AS parent_name
         FROM ${schema}.accounts account
         LEFT JOIN ${schema}.accounts parent ON parent.id = account.parent_id
        WHERE account.type = 'Revenue'
          AND account.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM ${schema}.accounts child
             WHERE child.parent_id = account.id AND child.is_active = true
          )
        ORDER BY account.code ASC`,
    );
  }

  private parseResult(content: string) {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      const value = JSON.parse(cleaned) as Record<string, unknown>;
      if (
        typeof value.accountId !== 'string' ||
        typeof value.confidence !== 'number' ||
        !Number.isFinite(value.confidence) ||
        typeof value.reason !== 'string'
      ) {
        throw new Error('Invalid classification fields');
      }
      return {
        accountId: value.accountId,
        confidence: value.confidence,
        reason: value.reason.trim() || 'Selected from the available revenue accounts.',
        alternativeAccountIds: Array.isArray(value.alternativeAccountIds)
          ? value.alternativeAccountIds.filter(
              (id): id is string => typeof id === 'string',
            )
          : [],
      };
    } catch {
      throw new BadGatewayException(
        'Revenue account classifier returned invalid JSON',
      );
    }
  }
}
