/**
 * Browser/Node-compatible HTTP client for the matchmaking app. Uses native
 * `fetch` (available in Node ≥18 and every modern browser) so it picks up no
 * runtime dependencies.
 *
 * Auth is delegated to a caller-supplied `getToken()` — the library never
 * stores credentials and never assumes a scheme; the returned string is sent
 * verbatim as the `Authorization` header.
 *
 * Formulas cross the wire as plain JSON ({@link FormulaWire}) since the
 * HTTP boundary cannot carry `AttributeTag` objects. Match completion is
 * surfaced by polling — `waitForMatch` resolves with the `matchId` the
 * server minted, which the caller typically uses as a Durable Object name
 * (or any other downstream match-room identifier).
 */

import type { AttributeState } from '@gamezilla/lib/attribute';
import { MatchmakingHttpError } from './client-error';
import type { FormulaWire } from './matchmaker';
import type {
  JoinResult,
  LeaveResult,
  MatchedStatus,
  StatusResult,
} from './types';

const DEFAULT_POLL_INTERVAL_MS = 1000;

export type MatchmakingClientOptions = {
  readonly baseUrl: string;
  readonly getToken: () => Promise<string>;
  readonly pollIntervalMs?: number;
  readonly fetch?: typeof globalThis.fetch;
};

export type WaitForMatchOptions = {
  readonly signal?: AbortSignal;
};

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}${path}`;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timeout);
      reject(new Error('waitForMatch aborted'));
    }
    if (signal !== undefined) {
      if (signal.aborted) {
        clearTimeout(timeout);
        reject(new Error('waitForMatch aborted'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export class MatchmakingClient {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string>;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(opts: MatchmakingClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.getToken = opts.getToken;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async join(
    data: AttributeState,
    formulas: readonly FormulaWire[]
  ): Promise<JoinResult> {
    return await this.request<JoinResult>('POST', '/join', { data, formulas });
  }

  async leave(playerId: string): Promise<LeaveResult> {
    return await this.request<LeaveResult>('POST', '/leave', { playerId });
  }

  async status(playerId: string): Promise<StatusResult | null> {
    const url = joinUrl(
      this.baseUrl,
      `/status/${encodeURIComponent(playerId)}`
    );
    const token = await this.getToken();
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: token },
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new MatchmakingHttpError(
        `status request failed: ${String(response.status)}`,
        response.status
      );
    }
    return (await response.json()) as StatusResult;
  }

  async waitForMatch(
    playerId: string,
    opts?: WaitForMatchOptions
  ): Promise<MatchedStatus> {
    const signal = opts?.signal;
    for (;;) {
      if (signal?.aborted === true) throw new Error('waitForMatch aborted');
      const current = await this.status(playerId);
      if (current === null) {
        throw new MatchmakingHttpError(`player ${playerId} not found`, 404);
      }
      if (current.status === 'matched') {
        return current;
      }
      await sleep(this.pollIntervalMs, signal);
    }
  }

  private async request<T>(
    method: 'POST',
    path: string,
    body: unknown
  ): Promise<T> {
    const url = joinUrl(this.baseUrl, path);
    const token = await this.getToken();
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new MatchmakingHttpError(
        `${method} ${path} failed: ${String(response.status)}`,
        response.status
      );
    }
    return (await response.json()) as T;
  }
}
