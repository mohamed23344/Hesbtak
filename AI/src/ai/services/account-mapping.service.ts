import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ACCOUNT_MAPPING_PROMPT } from '../prompts/account-mapping.prompt';

@Injectable()
export class AccountMappingService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async mapAccounts(data: any) {
    const response = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${this.configService.get('HF_TOKEN')}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          model:
            'meta-llama/Llama-3.3-70B-Instruct',

          messages: [
            {
              role: 'user',
              content: `
${ACCOUNT_MAPPING_PROMPT}

INPUT:

${JSON.stringify(data)}
`,
            },
          ],
        }),
      },
    );

    return response.json();
  }
}