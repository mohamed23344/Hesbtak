import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';

import Groq from 'groq-sdk';

export const LLM_MODELS = {
  CHATTING_AGENT: 'meta-llama/llama-4-scout-17b-16e-instruct',
  ORCHESTRATOR_AGENT: 'meta-llama/llama-4-scout-17b-16e-instruct',
  DATABASE_SEARCH_AGENT: 'meta-llama/llama-4-scout-17b-16e-instruct',
  FINANCIAL_REASONING_AGENT: 'meta-llama/llama-4-scout-17b-16e-instruct',
  REPORT_GENERATION_AGENT: 'meta-llama/llama-4-scout-17b-16e-instruct',
};

export function getGroqClient(config: ConfigService): Groq {
  const apiKey =
    config.get<string>('GROQ_API_KEY') ||
    process.env.GROQ_API_KEY;

  return new Groq({
    // Keep application startup independent from external AI configuration.
    // LanggraphService returns a clear 503 before making a request when absent.
    apiKey: apiKey || 'not-configured',
  });
}

export function hasGroqApiKey(config: ConfigService): boolean {
  return Boolean(
    config.get<string>('GROQ_API_KEY') || process.env.GROQ_API_KEY,
  );
}
/**
 * Instantiates the InferenceClient using the token from ConfigService or env.
 */
export function getHfClient(config: ConfigService): InferenceClient {
  const hfToken = config.get<string>('HF_TOKEN') || process.env.HF_TOKEN;
  return new InferenceClient(hfToken);
}
