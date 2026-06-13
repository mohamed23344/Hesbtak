import { ConfigService } from '@nestjs/config';
import {
  getLlmClient,
  getLlmProvider,
  hasLlmConfiguration,
  LLM_MODELS,
} from './llm.config';

describe('LLM provider configuration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects OpenAI and resolves its configured model', async () => {
    const config = new ConfigService({
      AI_LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'test-key',
      OPENAI_CHAT_MODEL: 'gpt-test',
    });
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
          { status: 200 },
        ),
      );

    expect(getLlmProvider(config)).toBe('openai');
    expect(hasLlmConfiguration(config)).toBe(true);

    await getLlmClient(config).chat.completions.create({
      model: LLM_MODELS.CHATTING_AGENT,
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"gpt-test"'),
      }),
    );
  });

  it('rejects unsupported providers', () => {
    const config = new ConfigService({ AI_LLM_PROVIDER: 'invalid' });
    expect(() => getLlmProvider(config)).toThrow('Unsupported AI_LLM_PROVIDER');
  });
});
