import { assert } from '@gamezilla/shared/assert';
import { fireAndForget } from '@gamezilla/shared/async/fire-and-forget';
import type { Unsubscribe } from '@gamezilla/shared/pub-sub/interface';
import { assertPatchDbSyncServerBaseUrl } from '../assert-sync-server-base-url';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { assertPatches, assertPatchesDbResults } from '../validate-remote';
import type { PatchDbClientTransport } from './interface';
import {
  PATCH_SUFFIX_EVENTS,
  PATCH_SUFFIX_READ,
  PATCH_SUFFIX_WRITE,
} from './paths';

export class PatchDbClientTransportHttpFetch implements PatchDbClientTransport {
  constructor(private baseUrl: string) {
    assertPatchDbSyncServerBaseUrl(baseUrl);
  }

  private requestUrl(path: string): string {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (error) {
      assert.ok(
        false,
        'Constructed patch-db URL must parse as an absolute URL',
        {
          baseUrl: this.baseUrl,
          path,
          url,
          error,
        }
      );
    }
    assert.ok(
      parsed.protocol === 'http:' || parsed.protocol === 'https:',
      'Constructed patch-db URL must use http: or https:',
      { baseUrl: this.baseUrl, path, url, protocol: parsed.protocol }
    );
    return url;
  }

  private async postUnvalidated(path: string, body: unknown): Promise<unknown> {
    const url = this.requestUrl(path);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  }

  async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    if (queries.length === 0) return [];
    const raw = await this.postUnvalidated(PATCH_SUFFIX_READ, { queries });
    assertPatchesDbResults(raw);
    return raw;
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    const raw = await this.postUnvalidated(PATCH_SUFFIX_WRITE, { patches });
    assertPatches(raw);
    return raw;
  }

  subscribe(callback: () => void): Unsubscribe {
    const url = this.requestUrl(PATCH_SUFFIX_EVENTS);
    let aborted = false;
    let retryDelayMs = 1000;
    const maxRetryDelayMs = 30000;
    let abortController: AbortController | null = null;

    let loggedFirstError = false;

    const connect = async (): Promise<void> => {
      if (aborted) return;
      abortController = new AbortController();
      try {
        const res = await fetch(url, {
          headers: { Accept: 'text/event-stream' },
          signal: abortController.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`SSE ${res.status}`);
        }
        retryDelayMs = 1000;
        loggedFirstError = false;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              callback();
            }
          }
        }
      } catch (err) {
        if (aborted) return;
        if (!loggedFirstError) {
          loggedFirstError = true;
          console.warn(
            '[PatchDbClientTransportHttpFetch] SSE disconnected, will retry silently:',
            err
          );
        }
        await new Promise((r) => setTimeout(r, retryDelayMs));
        retryDelayMs = Math.min(retryDelayMs * 2, maxRetryDelayMs);
      }
      if (!aborted)
        fireAndForget(connect(), { component: 'SSE', op: 'reconnect' });
    };
    fireAndForget(connect(), { component: 'SSE', op: 'connect' });
    return () => {
      aborted = true;
      abortController?.abort();
    };
  }
}
