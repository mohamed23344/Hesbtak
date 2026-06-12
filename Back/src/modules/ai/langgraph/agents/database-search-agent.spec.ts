import { BadRequestException } from '@nestjs/common';
import { DatabaseSearchAgentGraph } from './database-search-agent';

describe('DatabaseSearchAgentGraph SQL validation', () => {
  const agent = new DatabaseSearchAgentGraph(
    {} as never,
    {} as never,
  ) as unknown as {
    validateSql(sql: string, schema: string): void;
  };

  it('accepts a tenant-qualified read-only query', () => {
    expect(() =>
      agent.validateSql(
        'SELECT i.invoice_number FROM "tenant_abc"."invoices" i LIMIT 10',
        'tenant_abc',
      ),
    ).not.toThrow();
  });

  it('rejects cross-tenant access', () => {
    expect(() =>
      agent.validateSql(
        'SELECT i.invoice_number FROM "tenant_other"."invoices" i LIMIT 10',
        'tenant_abc',
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects mutations and select star', () => {
    expect(() =>
      agent.validateSql(
        'DELETE FROM "tenant_abc"."invoices"',
        'tenant_abc',
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      agent.validateSql(
        'SELECT * FROM "tenant_abc"."invoices"',
        'tenant_abc',
      ),
    ).toThrow(BadRequestException);
  });

});
