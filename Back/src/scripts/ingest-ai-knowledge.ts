import { readFile } from 'fs/promises';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  KnowledgeChunkInput,
  KnowledgeService,
} from '../modules/ai/knowledge/knowledge.service';

type ProductPage = {
  id: string;
  route: string;
  module: string;
  title: { en: string; ar: string };
  aliases: string[];
  description: string;
  capabilities: string[];
  prerequisites: string[];
  steps: string[];
  permissions: string[];
  relatedRoutes: string[];
  keywords: string[];
  sourceVersion: string;
};

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

function productChunks(pages: ProductPage[]): KnowledgeChunkInput[] {
  return pages.map((page) => ({
    corpus: 'product_guide',
    documentId: 'hesbetak-frontend-guide',
    chunkId: page.id,
    content: [
      `${page.title.en} | ${page.title.ar}`,
      `Route: ${page.route}`,
      page.description,
      `Aliases: ${page.aliases.join(', ')}`,
      `Capabilities:\n- ${page.capabilities.join('\n- ')}`,
      `Prerequisites:\n- ${page.prerequisites.join('\n- ')}`,
      `Steps:\n${page.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
      `Related routes: ${page.relatedRoutes.join(', ')}`,
    ].join('\n\n'),
    metadata: {
      route: page.route,
      module: page.module,
      title: page.title.en,
      titleAr: page.title.ar,
      permissions: page.permissions,
      sourceVersion: page.sourceVersion,
      contentType: 'product_page',
    },
  }));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const knowledge = app.get(KnowledgeService);
    const root = process.cwd();
    const productPath = join(
      root,
      'knowledge',
      'product',
      'frontend-pages.json',
    );
    const workbookPath = join(
      root,
      'knowledge',
      'accounting-workbook.chunks.json',
    );
    const products = await loadJson<ProductPage[]>(productPath);
    const workbook = await loadJson<KnowledgeChunkInput[]>(workbookPath);
    const productResult = await knowledge.upsert(productChunks(products));
    const workbookResult = await knowledge.upsert(workbook, {
      replaceCorpus: 'accounting_workbook',
    });
    console.log({ productResult, workbookResult });
  } finally {
    await app.close();
  }
}

void main();
