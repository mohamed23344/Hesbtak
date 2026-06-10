jest.mock('./langgraph/langgraph.service', () => ({
  LanggraphService: class LanggraphService {},
}));

import { ChatbotService } from './chatbot.service';

describe('ChatbotService', () => {
  it('passes session memory to LangGraph and returns only user-facing fields', async () => {
    const db = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          question: 'Show revenue for May',
          response: 'May revenue was 1000.',
        },
      ]),
    };
    const tenant = {
      quote: jest.fn().mockReturnValue('"tenant_test"'),
    };
    const langgraph = {
      run: jest.fn().mockResolvedValue({
        intent: 'databaseSearchAgent',
        agentOutput: 'AI-generated answer',
        finalResponse: 'AI-generated answer',
        reportMarkdown: null,
        unresolvedIntent: false,
      }),
    };
    const reports = {
      save: jest.fn(),
    };
    const service = new ChatbotService(
      db as never,
      tenant as never,
      langgraph as never,
      reports as never,
    );

    const result = await service.run(
      {
        organizationId: 'org-id',
        schemaName: 'tenant_test',
        role: 'owner',
      },
      'user-id',
      {
        userQuery: 'What about June?',
        sessionId: '11111111-1111-4111-8111-111111111111',
      },
    );

    expect(langgraph.run).toHaveBeenCalledWith(
      expect.objectContaining({ schemaName: 'tenant_test' }),
      expect.objectContaining({
        userId: 'user-id',
        userQuery: 'What about June?',
        conversationHistory:
          'User: Show revenue for May\nAssistant: May revenue was 1000.',
      }),
    );
    expect(result).toMatchObject({
      response: 'AI-generated answer',
    });
    expect(result).not.toHaveProperty('agent');
    expect(result).not.toHaveProperty('agentOutput');
  });
});
