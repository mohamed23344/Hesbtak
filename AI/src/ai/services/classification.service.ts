import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CLASSIFICATION_PROMPT } from '../prompts/classification.prompt';

@Injectable()
export class ClassificationService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  async classify(data: any) {
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
${CLASSIFICATION_PROMPT}

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