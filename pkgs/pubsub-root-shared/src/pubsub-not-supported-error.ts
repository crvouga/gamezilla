export class PubSubNotSupportedError extends Error {
  override readonly name = 'PubSubNotSupportedError';

  constructor(message = 'PubSub operation is not supported on this instance') {
    super(message);
  }
}
