/**
 * Thrown by {@link TtsClient.synthesize} when the API returns a non-2xx
 * response. Mirrors `TtsProviderError` on the server (502) but distinct so
 * client code can differentiate transport vs. provider failures.
 */
export class TtsClientError extends Error {
  readonly __ttsClientError = true as const;

  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'TtsClientError';
  }
}
