/** An intentional, temporary refusal of one query; never a transport outage. */
export class RetryableQueryError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfterMs: number,
    message: string
  ) {
    super(message);
    this.name = 'RetryableQueryError';
  }
}

export type QueryRetryNotice = {
  readonly code: string;
  readonly retryAfterMs: number;
};
