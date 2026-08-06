export class PubSubPublishError extends Error {
  override readonly name = 'PubSubPublishError';

  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string
  ) {
    super(message);
  }
}
