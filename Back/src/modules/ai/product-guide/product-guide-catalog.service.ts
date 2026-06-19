import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { join } from 'path';

export type ProductGuidePage = {
  id: string;
  route: string;
  module: string;
  title: { en: string; ar: string };
  aliases: string[];
  description: string;
  capabilities: string[];
  controls: string[];
  prerequisites: string[];
  keywords: string[];
};

@Injectable()
export class ProductGuideCatalogService implements OnModuleInit {
  private readonly logger = new Logger(ProductGuideCatalogService.name);
  private pages: ProductGuidePage[] = [];
  private summaryPrompt = '';

  async onModuleInit() {
    await this.load();
  }

  async load() {
    const path = join(process.cwd(), 'knowledge', 'product', 'frontend-pages.json');
    try {
      const raw = await readFile(path, 'utf8');
      this.pages = JSON.parse(raw) as ProductGuidePage[];
      this.summaryPrompt = this.buildSummaryPrompt(this.pages);
      this.logger.log(`Loaded ${this.pages.length} product guide pages.`);
    } catch (error) {
      this.logger.warn(`Product guide catalog unavailable at ${path}: ${String(error)}`);
      this.pages = [];
      this.summaryPrompt = 'Product guide catalog is unavailable.';
    }
  }

  prompt(): string {
    return this.summaryPrompt;
  }

  pageIds(): string[] {
    return this.pages.map((page) => page.id);
  }

  modules(): string[] {
    return [...new Set(this.pages.map((page) => page.module))].sort();
  }

  private buildSummaryPrompt(pages: ProductGuidePage[]): string {
    const byModule = new Map<string, ProductGuidePage[]>();
    for (const page of pages) {
      const group = byModule.get(page.module) ?? [];
      group.push(page);
      byModule.set(page.module, group);
    }

    const lines = [
      'Hesbetak product guide index — use page ids for targeted retrieval.',
      `Modules: ${[...byModule.keys()].join(', ')}`,
      '',
    ];

    for (const [module, modulePages] of [...byModule.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      lines.push(`## ${module}`);
      for (const page of modulePages) {
        const aliasHint = page.aliases.length ? ` | aliases: ${page.aliases.join(', ')}` : '';
        const keywordHint = page.keywords.length ? ` | keywords: ${page.keywords.join(', ')}` : '';
        lines.push(
          `- id=${page.id} | route=${page.route} | ${page.title.en} / ${page.title.ar}${aliasHint}`,
        );
        lines.push(`  ${page.description}${keywordHint}`);
        if (page.capabilities.length) {
          lines.push(`  capabilities: ${page.capabilities.join('; ')}`);
        }
        if (page.controls.length) {
          lines.push(`  controls: ${page.controls.join('; ')}`);
        }
        if (page.prerequisites.length) {
          lines.push(`  prerequisites: ${page.prerequisites.join('; ')}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }
}
