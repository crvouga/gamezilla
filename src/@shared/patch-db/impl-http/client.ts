import { assert } from '@/@shared/assert';
import { fireAndForget } from '../../async/fire-and-forget';
import type { Unsubscribe } from '../../pub-sub/interface';
import type {
  Patch,
  PatchesDb,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { validatePatches, validatePatchesDbResults } from '../validate-remote';
import { PATCHES_EVENTS, PATCHES_READ, PATCHES_WRITE } from './shared';

export type RemoteInvalidationSource = {
  subscribe(callback: () => void): Unsubscribe;
};

export function createRemoteInvalidationSource(
  baseUrl: string
): RemoteInvalidationSource {
  const url = `${baseUrl.replace(/\/$/, '')}${PATCHES_EVENTS}`;
  return {
    subscribe(callback: () => void): Unsubscribe {
      let aborted = false;
      let retryDelayMs = 1000;
      const maxRetryDelayMs = 30000;
      let abortController: AbortController | null = null;

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
          console.warn(
            '[RemoteInvalidationSource] SSE disconnected, reconnecting:',
            err
          );
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
    },
  };
}

export class PatchDbImplHttp implements PatchesDb {
  constructor(private baseUrl: string) {}

  private async postUnvalidated(path: string, body: unknown): Promise<unknown> {
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;
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
    const raw = await this.postUnvalidated(PATCHES_READ, { queries });
    validatePatchesDbResults(raw);
    return raw;
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    const raw = await this.postUnvalidated(PATCHES_WRITE, { patches });
    validatePatches(raw);
    return raw;
  }

  async update(
    _updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void> {
    assert(
      false,
      'attribute updates are local-only for sync; remote does not need'
    );
  }
}
