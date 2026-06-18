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

export type ExpenseAccountClassification = {
  accountId: string;
  code: string;
  name: string;
  confidence: number;
  reason: string;
};

type ExpenseAccount = {
  id: string;
  code: string;
  name: string;
  parent_code: string | null;
  parent_name: string | null;
};

@Injectable()
export class ExpenseAccountAgent {
  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
    private readonly config: ConfigService,
  ) {}

  async classify(
    ctx: TenantContext,
    vendorName: string | null,
    descriptions: string[],
  ): Promise<ExpenseAccountClassification> {
    const accounts = await this.availableExpenseAccounts(ctx);
    if (!accounts.length) {
      throw new BadRequestException(
        'Add at least one active expense account before creating a purchase bill',
      );
    }
    if (accounts.length === 1) {
      return this.classification(
        accounts[0],
        1,
        'This is the only available expense account.',
      );
    }
    if (!hasLlmConfiguration(this.config)) {
      throw new ServiceUnavailableException(
        'Expense account classification requires an AI provider configuration',
      );
    }

    const organization = await this.db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { industry: true },
    });
    const response = await getLlmClient(this.config).chat.completions.create({
      model: LLM_MODELS.EXPENSE_ACCOUNT_AGENT,
      messages: [
        {
          role: 'system',
          content: `You are an accountant.

Classify vendor invoice lines into the closest matching expense account.

Rules:
- Select exactly one account from Available Expense Accounts.
- Return the account's exact id. Never invent an account.
- Return JSON only:
{"accountId":"exact id","confidence":0.0,"reason":"short explanation"}`,
        },
        {
          role: 'user',
          content: `Available Expense Accounts:
${JSON.stringify(accounts.map(({ id, code, name }) => ({ id, code, name })))}

Business Type:
${organization?.industry ?? 'Not specified'}

Vendor Name:
${vendorName ?? 'Not specified'}

Invoice Lines:
${descriptions.join('\n')}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new BadGatewayException(
        'Expense account classifier returned no result',
      );
    }
    const result = this.parseResult(content);
    const selected = this.resolveAccount(accounts, result.accountReference);
    if (!selected) {
      throw new BadGatewayException(
        'Could not match the suggested expense account',
      );
    }
    return this.classification(
      selected,
      Math.max(0, Math.min(1, result.confidence)),
      result.reason,
    );
  }

  async selected(
    ctx: TenantContext,
    accountId: string,
  ): Promise<ExpenseAccountClassification> {
    const account = (await this.availableExpenseAccounts(ctx)).find(
      (candidate) => candidate.id === accountId,
    );
    if (!account) {
      throw new BadRequestException(
        'Select an active leaf expense account from the Chart of Accounts',
      );
    }
    return this.classification(account, 1, 'Selected by the user.');
  }

  private async availableExpenseAccounts(
    ctx: TenantContext,
  ): Promise<ExpenseAccount[]> {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe<ExpenseAccount[]>(
      `SELECT account.id, account.code, account.name,
              parent.code AS parent_code, parent.name AS parent_name
         FROM ${schema}.accounts account
         LEFT JOIN ${schema}.accounts parent ON parent.id = account.parent_id
        WHERE account.type = 'Expense'
          AND account.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM ${schema}.accounts child
             WHERE child.parent_id = account.id AND child.is_active = true
          )
        ORDER BY account.code ASC`,
    );
  }

  private classification(
    account: ExpenseAccount,
    confidence: number,
    reason: string,
  ): ExpenseAccountClassification {
    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      confidence,
      reason,
    };
  }

  private resolveAccount(
    accounts: ExpenseAccount[],
    reference: string,
  ): ExpenseAccount | undefined {
    const normalized = reference.trim().toLocaleLowerCase();
    return accounts.find(
      (account) =>
        account.id.toLocaleLowerCase() === normalized ||
        account.code.toLocaleLowerCase() === normalized ||
        account.name.trim().toLocaleLowerCase() === normalized ||
        `${account.code} - ${account.name}`.toLocaleLowerCase() === normalized,
    );
  }

  private parseResult(content: string) {
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      const value = JSON.parse(cleaned) as Record<string, unknown>;
      const accountReference = [
        value.accountId,
        value.account_id,
        value.accountCode,
        value.code,
        value.account,
        value.name,
      ].find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
      if (!accountReference) {
        throw new Error('Invalid classification fields');
      }
      return {
        accountReference,
        confidence:
          typeof value.confidence === 'number' && Number.isFinite(value.confidence)
            ? value.confidence
            : 0.8,
        reason:
          typeof value.reason === 'string' && value.reason.trim()
            ? value.reason.trim()
            : 'Closest matching expense account.',
      };
    } catch {
      throw new BadGatewayException(
        'Expense account classifier returned invalid JSON',
      );
    }
  }
}
