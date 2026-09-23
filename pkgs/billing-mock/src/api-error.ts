import type { MockErrorBody } from './wire';

/** A non-2xx answer from the provider, with its error envelope. */
export class MockBillingApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: MockErrorBody | null
  ) {
    super(
      body?.error.message ??
        `mock billing: HTTP ${String(status)} from provider`
    );
    this.name = 'MockBillingApiError';
  }
}
