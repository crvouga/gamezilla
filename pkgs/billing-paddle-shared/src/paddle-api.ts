/**
 * A minimal Paddle Billing REST client over an injected `fetch`: bearer auth,
 * the pinned API version, Paddle's `{ data, meta }` envelope and its error
 * envelope. No SDK, so it runs unchanged on Workers, Bun and in tests.
 */
import { PaddleApiError } from './paddle-api-error';
import type { PaddleEnvelope, PaddleErrorBody } from './wire';
import {
  PADDLE_API_VERSION,
  PADDLE_LIVE_ORIGIN,
  PADDLE_SANDBOX_ORIGIN,
} from './wire';

export type PaddleFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Sandbox keys (`pdl_sdbx_…`) talk to the sandbox; everything else to live. */
export function paddleOriginForApiKey(apiKey: string): string {
  return apiKey.startsWith('pdl_sdbx_')
    ? PADDLE_SANDBOX_ORIGIN
    : PADDLE_LIVE_ORIGIN;
}

export class PaddleApi {
  constructor(
    private readonly options: {
      readonly apiKey: string;
      readonly origin: string;
      readonly fetch: PaddleFetch;
    }
  ) {}

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown
  ): Promise<PaddleEnvelope<T>> {
    const response = await this.options.fetch(
      new URL(path, this.options.origin).toString(),
      {
        method,
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'paddle-version': PADDLE_API_VERSION,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }
    );
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const error = (payload as PaddleErrorBody | null)?.error;
      throw new PaddleApiError(
        response.status,
        error?.code ?? null,
        error?.detail ?? null
      );
    }
    return payload as PaddleEnvelope<T>;
  }

  async data<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown
  ): Promise<T> {
    return (await this.request<T>(method, path, body)).data;
  }

  /** Every page of a list endpoint, following Paddle's `next` cursor. */
  async list<T>(path: string): Promise<readonly T[]> {
    const out: T[] = [];
    let next: string | null = path;
    for (let page = 0; next !== null && page < 100; page += 1) {
      const envelope: PaddleEnvelope<readonly T[]> = await this.request<
        readonly T[]
      >('GET', next);
      out.push(...envelope.data);
      const cursor = envelope.meta?.pagination;
      // `next` is absolute at Paddle's origin; keep only path + query so the
      // configured origin (a sandbox, a fake) is the one asked.
      next =
        cursor?.has_more === true && typeof cursor.next === 'string'
          ? `${new URL(cursor.next).pathname}${new URL(cursor.next).search}`
          : null;
    }
    return out;
  }
}
