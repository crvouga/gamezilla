/** Thrown when a visibility or write policy rejects an operation (HTTP 403). */
export class ForbiddenError extends Error {
  override readonly name = 'ForbiddenError';

  constructor(
    message: string,
    readonly context?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
