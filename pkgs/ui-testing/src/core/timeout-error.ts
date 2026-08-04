import { UiTestError } from './ui-test-error';

/** Polling timed out before a condition became true. */
export class TimeoutError extends UiTestError {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}
