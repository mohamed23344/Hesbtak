import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QwenService {
  constructor(private readonly configService: ConfigService) {}

  async extractInvoice(imageBase64: string, prompt: string) {
    const response = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${this.configService.get('HF_TOKEN')}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          model: 'Qwen/Qwen3-VL-235B-A22B-Instruct:novita',

          temperature: 0,

          max_tokens: 1000,

          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },

                {
                  type: 'image_url',
                  image_url: {
                    url: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    return response.json();
  }
}
