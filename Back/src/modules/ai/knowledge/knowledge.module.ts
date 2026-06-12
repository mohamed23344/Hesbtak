import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [EmbeddingsModule, PrismaModule],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
