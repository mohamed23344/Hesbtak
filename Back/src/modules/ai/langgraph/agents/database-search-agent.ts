import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import Groq from 'groq-sdk';
import { DatabaseCatalogService } from '../../database-catalog/database-catalog.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FinancialDataRequest,
  QueryEvidence,
} from '../contracts';
import { LLM_MODELS } from '../config/llm.config';
import { StateType } from '../state/graph-state';
import { qualifyTenantTables, TENANT_SQL_TABLES } from './tenant-sql';

@Injectable()
export class DatabaseSearchAgentGraph {
  private readonly logger = new Logger(DatabaseSearchAgentGraph.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: DatabaseCatalogService,
  ) {}

  async executeRequests(
    state: StateType,
    requests: FinancialDataRequest[],
    groqClient: Groq,
  ): Promise<QueryEvidence[]> {
    const bounded = requests.slice(0, 10);
    return Promise.all(
      bounded.map((request) =>
        this.executeRequest(state, request, groqClient),
      ),
    );
  }

  async invoke(
    state: StateType,
    groqClient: Groq,
  ): Promise<Partial<StateType>> {
    const request: FinancialDataRequest = {
      requestId: 'FIN-1',
      objective: state.userQuery,
      businessQuestion: state.userQuery,
      metrics: [],
      dimensions: [],
      filters: [],
      expectedColumns: [],
      preferredGranularity: 'summary',
      maxRows: 50,
      reason: 'Answer the user request with verified organization data.',
    };
    const queryEvidence = await this.executeRequests(
      state,
      [request],
      groqClient,
    );
    return { queryEvidence, unresolvedIntent: false };
  }

  private async executeRequest(
    state: StateType,
    request: FinancialDataRequest,
    groqClient: Groq,
  ): Promise<QueryEvidence> {
    const maxRows = Math.min(Math.max(request.maxRows || 50, 1), 200);
    const startedAt = Date.now();
    try {
      const response = await groqClient.chat.completions.create({
          model: LLM_MODELS.DATABASE_SEARCH_AGENT,
          messages: [
            {
              role: 'system',
              content: `You generate one PostgreSQL read-only query for an accounting SaaS.
Return SQL only, without Markdown or explanation.
Use SELECT or WITH ... SELECT only.
Never use SELECT *.
Never use DDL, DML, COPY, CALL, system catalogs, or cross-schema access.
Use explicit aliases and column names.
Use the supplied metric definitions.
Honor the request dateRange exactly. Never include records after the current
as-of date ${new Date().toISOString().slice(0, 10)}.
Aggregate queries must return COALESCE values so a valid zero is distinguishable
from missing evidence.
For detail queries include LIMIT ${maxRows}.
For aggregate queries, limit grouped output to ${maxRows}.

${this.catalog.prompt(state.orgSlug)}`,
            },
            {
              role: 'user',
              content: JSON.stringify(request),
            },
          ],
          temperature: 0,
          max_tokens: 1400,
        });
      const rawSql = this.extractSql(
        response.choices[0]?.message?.content ?? '',
      );
      const sql = qualifyTenantTables(rawSql, state.orgSlug);
      this.validateSql(sql, state.orgSlug);
      const boundedSql = `WITH ai_evidence AS (${sql})
SELECT * FROM ai_evidence LIMIT ${maxRows + 1}`;
      const rows = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
          await tx.$executeRawUnsafe(
            `SET LOCAL statement_timeout = '5000ms'`,
          );
          return tx.$queryRawUnsafe<Record<string, unknown>[]>(boundedSql);
        },
        { maxWait: 5_000, timeout: 7_000 },
      );
      const normalized = this.normalizeRows(rows).slice(0, maxRows);
      return {
        requestId: request.requestId,
        objective: request.objective,
        dateRange: request.dateRange,
        status: normalized.length ? 'success' : 'empty',
        sql,
        columns: normalized[0] ? Object.keys(normalized[0]) : [],
        rows: normalized,
        rowCount: normalized.length,
        truncation: {
          applied: rows.length > maxRows,
          limit: maxRows,
        },
        assumptions: this.periodAssumptions(request),
        warnings:
          rows.length > maxRows
            ? [`Result was truncated to ${maxRows} rows.`]
            : [],
        executionMs: Date.now() - startedAt,
      };
    } catch (error) {
      const rejected = error instanceof BadRequestException;
      this.logger.warn(
        `Database evidence ${request.requestId} ${rejected ? 'rejected' : 'failed'}: ${String(error)}`,
      );
      return {
        requestId: request.requestId,
        objective: request.objective,
        dateRange: request.dateRange,
        status: rejected ? 'rejected' : 'error',
        columns: [],
        rows: [],
        rowCount: 0,
        assumptions: this.periodAssumptions(request),
        warnings: [error instanceof Error ? error.message : String(error)],
        executionMs: Date.now() - startedAt,
      };
    }
  }

  private extractSql(value: string) {
    return value
      .replace(/```sql/gi, '')
      .replace(/```/g, '')
      .trim()
      .replace(/;+\s*$/, '');
  }

  private validateSql(sql: string, schemaName: string) {
    const normalized = sql
      .replace(/'(?:''|[^'])*'/g, "''")
      .replace(/--.*$/gm, '')
      .trim();
    if (!/^(select|with)\b/i.test(normalized)) {
      throw new BadRequestException('Only SELECT queries are allowed.');
    }
    if (/\bselect\s+\*/i.test(normalized)) {
      throw new BadRequestException('SELECT * is not allowed.');
    }
    if (normalized.includes(';')) {
      throw new BadRequestException('Multiple SQL statements are not allowed.');
    }
    const blocked =
      /\b(insert|update|delete|merge|drop|alter|truncate|create|grant|revoke|copy|call|execute|do|vacuum|analyze|refresh|set|show)\b/i;
    if (blocked.test(normalized)) {
      throw new BadRequestException('Unsafe SQL operation was rejected.');
    }
    if (
      /\b(pg_catalog|information_schema|pg_read_file|pg_ls_dir|dblink|lo_import|lo_export)\b/i.test(
        normalized,
      )
    ) {
      throw new BadRequestException('System database access is not allowed.');
    }
    const references = Array.from(
      normalized.matchAll(
        /\b(?:from|join)\s+(?:"([^"]+)"|([a-zA-Z_][\w]*))\s*\.\s*"?(?<table>[a-zA-Z_][\w]*)"?/gi,
      ),
    );
    if (references.length === 0) {
      throw new BadRequestException('Query must use tenant-qualified tables.');
    }
    for (const match of references) {
      const referencedSchema = match[1] ?? match[2];
      const table = match.groups?.table?.toLowerCase();
      if (referencedSchema !== schemaName) {
        throw new BadRequestException('Cross-tenant SQL is not allowed.');
      }
      if (!TENANT_SQL_TABLES.includes(table as never)) {
        throw new BadRequestException(`Table is not allowed: ${table}`);
      }
    }
  }

  private normalizeRows(rows: Record<string, unknown>[]) {
    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === 'bigint' ? Number(value) : value,
        ]),
      ),
    );
  }

  private periodAssumptions(request: FinancialDataRequest) {
    if (!request.dateRange?.from && !request.dateRange?.to) return [];
    return [
      `Requested period: ${request.dateRange.from ?? 'unbounded'} through ${request.dateRange.to ?? 'unbounded'}.`,
    ];
  }
}
