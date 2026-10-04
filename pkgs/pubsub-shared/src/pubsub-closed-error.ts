export class PubSubClosedError extends Error {
  override readonly name = 'PubSubClosedError';

  constructor(message = 'PubSub is closed') {
    super(message);
  }
}
