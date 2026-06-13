import { Module } from '@nestjs/common';
import { EmbeddingProviderService } from './embedding-provider';

@Module({
  providers: [EmbeddingProviderService],
  exports: [EmbeddingProviderService],
})
export class EmbeddingsModule {}
