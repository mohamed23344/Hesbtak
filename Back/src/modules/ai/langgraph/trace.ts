import { Logger } from '@nestjs/common';
import { StateType } from './state/graph-state';

const logger = new Logger('ChatbotTrace');

export function aiTrace(
  state: Partial<StateType>,
  event: string,
  details: Record<string, unknown> = {},
) {
  logger.log(
    `[AI_TRACE] ${JSON.stringify({
      traceId: state.traceId ?? 'untracked',
      event,
      ...details,
    })}`,
  );
}

export function aiTraceWarn(
  state: Partial<StateType>,
  event: string,
  details: Record<string, unknown> = {},
) {
  logger.warn(
    `[AI_TRACE] ${JSON.stringify({
      traceId: state.traceId ?? 'untracked',
      event,
      ...details,
    })}`,
  );
}

export function summarizeText(value?: string, maxLength = 120) {
  if (!value) return '';
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= maxLength
    ? compact
    : `${compact.slice(0, maxLength - 3)}...`;
}

export function errorSummary(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
