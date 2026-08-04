/**
 * Base error for all UI-testing failures. Drivers and assertions throw
 * subclasses so consumers can distinguish timeout / capability / query miss.
 */
export class UiTestError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UiTestError';
  }
}
