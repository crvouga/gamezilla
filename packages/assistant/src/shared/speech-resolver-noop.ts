import type { AssistantSpeechRequest, AssistantSpeechResolver } from './speech-resolver';

export function createNoopSpeechResolver(): AssistantSpeechResolver {
  return {
    id: 'noop',
    async resolve(
      _request: AssistantSpeechRequest,
      _signal: AbortSignal
    ): Promise<string | null> {
      return null;
    },
  };
}
