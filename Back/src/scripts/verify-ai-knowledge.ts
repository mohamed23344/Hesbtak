import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { KnowledgeService } from '../modules/ai/knowledge/knowledge.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const knowledge = app.get(KnowledgeService);
    const status = await knowledge.status();
    const accounting = await knowledge.retrieve(
      ['allowance for doubtful accounts receivables'],
      ['accounting_workbook'],
      3,
    );
    const product = await knowledge.retrieve(
      ['where do I record a customer payment collection'],
      ['product_guide'],
      3,
    );
    console.log(
      JSON.stringify(
        {
          status,
          accounting: accounting.map((item) => ({
            chunkId: item.chunk_id,
            page: item.metadata.pageStart,
            score: item.fused_score,
          })),
          product: product.map((item) => ({
            chunkId: item.chunk_id,
            route: item.metadata.route,
            score: item.fused_score,
          })),
        },
        (_key, value) =>
          typeof value === 'bigint' ? Number(value) : value,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

void main();
