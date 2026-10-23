/** A non-2xx answer from Paddle, with its error code when it sent one. */
export class PaddleApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    readonly detail: string | null
  ) {
    super(
      `paddle: HTTP ${String(status)}${code === null ? '' : ` ${code}`}${detail === null ? '' : `: ${detail}`}`
    );
    this.name = 'PaddleApiError';
  }
}
