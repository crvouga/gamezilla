import type {
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
} from '../shared/tts-types';
import { TtsClientError } from './tts-client-error';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type TtsClientOptions = {
  /** Origin of the API Worker, e.g. `https://api.gamezilla.app`. No trailing slash. */
  readonly apiUrl: string;
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
 * Thin fetch wrapper for `POST /tts/synthesize`. The audio bytes themselves
 * are streamed by the playback layer (`use-tts-player`) via a plain GET to
 * `response.url`, so this client only deals in JSON.
 *
 * Every request body carries the full `text` / `voice` / `format` triple —
 * the server does not fill in defaults and will return `400` if any field
 * is missing.
 *
 * The caller's `fetch` is used verbatim — if you need to attach an
 * `Authorization` header, supply a wrapped fetch (the same pattern
 * `@gamezilla/auth/client/refresh-auth-fetch.ts` uses).
 */
export class TtsClient {
  private readonly base: string;
  private readonly fetchFn: FetchFn;

  constructor(options: TtsClientOptions) {
    this.base = trimBaseUrl(options.apiUrl);
    this.fetchFn =
      options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  async synthesize(
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

    const response = await this.fetchFn(`${this.base}/tts/synthesize`, init);
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

  /**
   * Resolves the server's root-relative `url` (`/tts/audio/<hash>.<ext>`)
   * against the configured `apiUrl`. The server returns relative URLs
   * because `wrangler dev` rewrites the request URL to the configured route
   * domain (`api.gamezilla.app`) — relying on the server-side origin would
   * break local playback.
   */
  private absolutize(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${this.base}${url.startsWith('/') ? url : `/${url}`}`;
  }
}
