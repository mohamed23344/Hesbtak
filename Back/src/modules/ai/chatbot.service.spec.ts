jest.mock('./langgraph/langgraph.service', () => ({
  LanggraphService: class LanggraphService {},
}));

import { ChatbotService } from './chatbot.service';

describe('ChatbotService', () => {
  it('uses LangGraph and exposes the selected AI agent', async () => {
    const db = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
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
      { userQuery: 'Show my latest invoices' },
    );

    expect(langgraph.run).toHaveBeenCalledWith(
      expect.objectContaining({ schemaName: 'tenant_test' }),
      expect.objectContaining({
        userId: 'user-id',
        userQuery: 'Show my latest invoices',
      }),
    );
    expect(result).toMatchObject({
      engine: 'langgraph',
      agent: 'databaseSearchAgent',
      response: 'AI-generated answer',
    });
  });
});
