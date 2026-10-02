/**
 * Browser/Node-compatible HTTP client for the matchmaking app.
 *
 * Auth is delegated to a caller-supplied `getToken()` — the library never
 * stores credentials and never assumes a scheme; the returned string is sent
 * verbatim as the `Authorization` header.
 *
 * Formulas cross the wire as plain JSON ({@link FormulaWire}) since the
 * HTTP boundary cannot carry `AttributeTag` objects. Match completion is
 * surfaced by polling — `waitForMatch` resolves with the `matchId` the
 * server minted, which the caller typically uses as a downstream handle
 * (Durable Object name, room identifier, etc.) to bring the match online.
 */

import type { HttpClient } from '@pkgs/http-client';
import type { FormulaWire } from '../interface/formula-wire';
import type { JoinInputRaw } from '../interface/matchmaking';
import type {
  JoinResult,
  LeaveResult,
  StatusResult,
  UpdateFormulasResult,
} from '../interface/types';
import { MatchmakingHttpError } from './client-error';

export type MatchmakingClientOptions = {
  readonly baseUrl: string;
  readonly getToken: () => Promise<string>;
  readonly http: HttpClient;
};

function joinUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}${path}`;
}

export class MatchmakingClient {
  private readonly baseUrl: string;
  private readonly getToken: () => Promise<string>;
  private readonly http: HttpClient;

  constructor(opts: MatchmakingClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.getToken = opts.getToken;
    this.http = opts.http;
  }

  async join(input: Omit<JoinInputRaw, 'ownerId'>): Promise<JoinResult> {
    return this.request<JoinResult>('POST', '/join', input);
  }

  /**
   * Replaces a waiting participant's formulas without losing queue
   * position. Resolves with `{ updated: true }` when the participant
   * was still waiting; resolves with `{ updated: false }` (HTTP 404)
   * when they're matched, swept, or unknown.
   */
  async updateFormulas(
    requestId: string,
    participantId: string,
    formulas: readonly FormulaWire[]
  ): Promise<UpdateFormulasResult> {
    const url = joinUrl(
      this.baseUrl,
      `/update-formulas/${encodeURIComponent(participantId)}`
    );
    const token = await this.getToken();
    const response = await this.http.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId, formulas }),
    });
    if (response.status === 404) return { updated: false };
    if (!response.ok) {
      throw new MatchmakingHttpError(
        `update-formulas failed: ${String(response.status)}`,
        response.status
      );
    }
    return (await response.json()) as UpdateFormulasResult;
  }

  async leave(requestId: string, participantId: string): Promise<LeaveResult> {
    return await this.request<LeaveResult>('POST', '/leave', {
      requestId,
      participantId,
    });
  }

  async status(participantId: string): Promise<StatusResult | null> {
    const url = joinUrl(
      this.baseUrl,
      `/status/${encodeURIComponent(participantId)}`
    );
    const token = await this.getToken();
    const response = await this.http.fetch(url, {
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

  private async request<T>(
    method: 'POST',
    path: string,
    body: unknown
  ): Promise<T> {
    const url = joinUrl(this.baseUrl, path);
    const token = await this.getToken();
    const response = await this.http.fetch(url, {
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
