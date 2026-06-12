import { ConfigService } from '@nestjs/config';
import { EmbeddingProviderService } from './embedding-provider';

describe('EmbeddingProviderService', () => {
  it('creates stable configured-dimensional vectors in mock mode', async () => {
    const service = new EmbeddingProviderService(
      new ConfigService({
        AI_EMBEDDING_PROVIDER: 'mock',
        AI_EMBEDDING_DIMENSIONS: '2000',
      }),
    );
    const [first, second, different] = await service.embedMany([
      'invoice cloud hosting',
      'invoice cloud hosting',
      'office rent',
    ]);

    expect(first).toHaveLength(2000);
    expect(second).toEqual(first);
    expect(different).not.toEqual(first);
  });
});
