import type { ObjectStore } from '@pkgs/object-store/interface';

import { ttsCacheKey } from '../shared/tts-cache-key';
import {
  ttsContentTypeFor,
  type TtsSynthesizeRequest,
  type TtsSynthesizeResponse,
} from '../shared/tts-types';
import { ttsProviderIdForVoice } from '../shared/tts-voice';
import { TtsClientError } from './tts-client-error';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type TtsClientOptions = {
  /** Origin of the API Worker, e.g. `https://api.example.com`. No trailing slash. */
  readonly apiUrl: string;
  /**
   * Local-first audio cache. The client computes the same SHA-256 cache key
   * the server uses (`ttsCacheKey({providerId, voice, text, format})`) and
   * skips the network entirely when {@link ObjectStore.head} reports a hit.
   * On a miss the audio bytes are downloaded once and `put` into the store
   * so subsequent calls for the same `(text, voice, format)` triple resolve
   * to a local URI without hitting the API.
   */
  readonly objectStore: ObjectStore;
  /** Override `globalThis.fetch` (used for tests / authenticated wrappers). */
  readonly fetch?: FetchFn;
};

export type TtsClientSynthesizeRequest = TtsSynthesizeRequest & {
  readonly signal?: AbortSignal;
};

function trimBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Cache-first thin fetch wrapper for `POST /tts/synthesize`. Every call
 * computes the SHA-256 cache key locally; when the bound {@link ObjectStore}
 * already has bytes for that key, no network I/O happens — the synthesised
 * response points at a local URI that `expo-audio` can play directly. On a
 * miss the JSON synth call runs, the audio bytes are streamed to the local
 * store, and the returned `url` is rewritten to the local URI so playback
 * never hits the network for the same utterance again.
 *
 * The caller's `fetch` is used verbatim — if you need to attach an
 * `Authorization` header, supply a wrapped fetch (the same pattern
 * `@libs/auth/client/refresh-auth-fetch.ts` uses).
 */
export class TtsClient {
  private readonly base: string;
  private readonly fetchFn: FetchFn;
  private readonly objectStore: ObjectStore;

  constructor(options: TtsClientOptions) {
    this.base = trimBaseUrl(options.apiUrl);
    this.fetchFn =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.objectStore = options.objectStore;
  }

  async synthesize(
    req: TtsClientSynthesizeRequest
  ): Promise<TtsSynthesizeResponse> {
    const key = await ttsCacheKey({
      providerId: ttsProviderIdForVoice(req.voice),
      voice: req.voice,
      text: req.text,
      format: req.format,
    });

    if (await this.objectStore.head(key)) {
      const cached = await this.objectStore.getUri(key);
      if (cached !== null) {
        return {
          url: cached,
          hash: key,
          contentType: ttsContentTypeFor(req.format),
          cached: true,
        };
      }
    }

    const remote = await this.synthesizeRemote(req);
    const audio = await this.downloadAudio(remote.url, req.signal);
    await this.objectStore.put(key, audio.bytes, audio.contentType);
    const localUri = await this.objectStore.getUri(key);
    return {
      ...remote,
      url: localUri ?? remote.url,
      cached: false,
    };
  }

  private async synthesizeRemote(
    req: TtsClientSynthesizeRequest
  ): Promise<TtsSynthesizeResponse> {
    const body: TtsSynthesizeRequest = {
      text: req.text,
      voice: req.voice,
      format: req.format,
    };

    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };
    if (req.signal !== undefined) init.signal = req.signal;

    const response = await this.fetchFn(
      `${this.base}/api/tts/synthesize`,
      init
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsClientError(
        `tts synthesize failed: HTTP ${response.status} — ${detail.slice(0, 256)}`,
        response.status
      );
    }
    const raw = (await response.json()) as TtsSynthesizeResponse;
    return { ...raw, url: this.absolutize(raw.url) };
  }

  private async downloadAudio(
    url: string,
    signal: AbortSignal | undefined
  ): Promise<{ bytes: Uint8Array; contentType: string }> {
    const init: RequestInit = { method: 'GET' };
    if (signal !== undefined) init.signal = signal;
    const response = await this.fetchFn(url, init);
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new TtsClientError(
        `tts audio download failed: HTTP ${response.status} — ${detail.slice(0, 256)}`,
        response.status
      );
    }
    const buf = await response.arrayBuffer();
    const contentType =
      response.headers.get('Content-Type') ?? 'application/octet-stream';
    return { bytes: new Uint8Array(buf), contentType };
  }

  /**
   * Resolves the server's root-relative `url` (`/tts/audio/<hash>.<ext>`)
   * against the configured `apiUrl`. The server returns relative URLs
   * because `wrangler dev` rewrites the request URL to the configured route
   * domain (e.g. `api.example.com`) — relying on the server-side origin would
   * break local playback.
   */
  private absolutize(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const path = url.startsWith('/') ? url : `/${url}`;
    if (path.startsWith('/api/')) {
      return `${this.base}${path}`;
    }
    if (path.startsWith('/tts/')) {
      return `${this.base}/api${path}`;
    }
    return `${this.base}${path}`;
  }
}
