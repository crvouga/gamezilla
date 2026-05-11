import type { ObjectStore } from '@gamezilla/lib/object-store/interface';
import { Hono } from 'hono';
import {
  TTS_AUDIO_FORMATS,
  ttsContentTypeFor,
  type TtsAudioFormat,
  type TtsSynthesizeResponse,
} from '../shared/tts-types';
import {
  TtsProviderError,
  isTtsProviderError,
  type TtsProvider,
} from './ports/tts-provider';
import { synthesizeWithCache, ttsObjectKey } from './tts-synthesize';

const TEXT_MAX_LEN = 5000;
const HASH_PATTERN = /^[0-9a-f]{32}$/;

/**
 * Optional auth gate. The host injects e.g. the API Worker's
 * `sessionAuth.requireAuthContext`; when omitted the package is fully
 * standalone and the synthesize endpoint is unauthenticated. Throwing from
 * `requireAuth` (typically `UnauthorizedError`) bubbles up to the host's
 * global `app.onError` for status mapping.
 */
export type TtsRequireAuth = (req: Request) => Promise<unknown>;

export type CreateTtsAppOptions = {
  readonly provider: TtsProvider;
  readonly objectStore: ObjectStore;
  readonly requireAuth?: TtsRequireAuth;
};

type ParsedSynthesizeBody =
  | {
      readonly ok: true;
      readonly text: string;
      readonly voiceId: string;
      readonly model: string;
      readonly format: TtsAudioFormat;
    }
  | { readonly ok: false; readonly error: string };

function pickStringOrDefault(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function parseFormat(
  raw: unknown
): TtsAudioFormat | { readonly error: string } {
  if (raw === undefined || raw === null || raw === '') return 'mp3';
  if (typeof raw !== 'string') {
    return { error: 'format must be a string' };
  }
  if (!(TTS_AUDIO_FORMATS as readonly string[]).includes(raw)) {
    return {
      error: `format must be one of: ${TTS_AUDIO_FORMATS.join(', ')}`,
    };
  }
  return raw as TtsAudioFormat;
}

function parseText(raw: unknown): string | { readonly error: string } {
  if (typeof raw !== 'string') {
    return { error: 'text must be a string' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { error: 'text must be non-empty' };
  }
  if (trimmed.length > TEXT_MAX_LEN) {
    return { error: `text must be <= ${TEXT_MAX_LEN} chars` };
  }
  return trimmed;
}

function parseSynthesizeBody(
  raw: unknown,
  provider: TtsProvider
): ParsedSynthesizeBody {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const obj = raw as Record<string, unknown>;

  const text = parseText(obj['text']);
  if (typeof text !== 'string') return { ok: false, error: text.error };

  const format = parseFormat(obj['format']);
  if (typeof format !== 'string') return { ok: false, error: format.error };

  return {
    ok: true,
    text,
    voiceId: pickStringOrDefault(obj['voiceId'], provider.defaultVoiceId),
    model: pickStringOrDefault(obj['model'], provider.defaultModel),
    format,
  };
}

/**
 * Audio URL is returned as a root-relative path (`/tts/audio/<hash>.<ext>`)
 * because `wrangler dev` rewrites `request.url` to the configured route's
 * custom domain even when serving on `127.0.0.1`. The client knows its real
 * `apiUrl` and resolves the absolute URL itself in `TtsClient.synthesize`.
 */
function buildAudioPath(hash: string, format: TtsAudioFormat): string {
  return `/tts/audio/${hash}.${format}`;
}

function audioCacheHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Required so COEP=`require-corp` documents (e.g. our Expo dev server, which
    // sets it for SharedArrayBuffer / absurd-sql) can load this audio
    // cross-origin via `<audio src>`. Without CORP, the browser silently blocks
    // the resource and surfaces only "no supported source was found".
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };
}

/**
 * Hono sub-app exposing the TTS HTTP surface.
 *
 * Routes:
 *   - `POST /tts/synthesize` — generate (or cache-hit) audio for a text.
 *   - `GET  /tts/audio/:hash` — stream the cached audio bytes. The `:hash`
 *     param accepts an optional `.mp3` / `.wav` suffix purely as a hint to
 *     downstream caches / players; the suffix participates in the
 *     {@link ObjectStore} key so callers must pass back the URL the
 *     synthesize response returned (don't strip the extension).
 *
 * Mount at `/` on a parent app that supplies its own Bindings. The package
 * never declares Worker bindings of its own.
 */
export function createTtsApp(options: CreateTtsAppOptions) {
  const { provider, objectStore, requireAuth } = options;

  return new Hono()
    .post('/tts/synthesize', async (c) => {
      if (requireAuth !== undefined) {
        await requireAuth(c.req.raw);
      }
      const raw: unknown = await c.req.json().catch(() => null);
      const parsed = parseSynthesizeBody(raw, provider);
      if (!parsed.ok) {
        return c.json({ error: parsed.error }, 400);
      }

      try {
        const result = await synthesizeWithCache(
          { provider, objectStore },
          {
            text: parsed.text,
            voiceId: parsed.voiceId,
            model: parsed.model,
            format: parsed.format,
          }
        );
        const body: TtsSynthesizeResponse = {
          url: buildAudioPath(result.hash, parsed.format),
          hash: result.hash,
          contentType: result.contentType,
          cached: result.cached,
        };
        return c.json(body, 200);
      } catch (err: unknown) {
        if (isTtsProviderError(err)) {
          return c.json(
            { error: err.message, providerId: err.providerId },
            502
          );
        }
        throw err;
      }
    })
    .get('/tts/audio/:hashWithExt', async (c) => {
      const param = c.req.param('hashWithExt');
      const dotIdx = param.lastIndexOf('.');
      const hash = dotIdx > 0 ? param.slice(0, dotIdx) : param;
      const ext = dotIdx > 0 ? param.slice(dotIdx + 1) : 'mp3';
      if (!HASH_PATTERN.test(hash)) {
        return c.json({ error: 'invalid hash' }, 400);
      }
      if (!(TTS_AUDIO_FORMATS as readonly string[]).includes(ext)) {
        return c.json({ error: 'invalid extension' }, 400);
      }
      const format = ext as TtsAudioFormat;
      const key = ttsObjectKey(provider.id, hash, format);
      const stored = await objectStore.get(key);
      if (stored === null) {
        return c.json({ error: 'not found' }, 404);
      }
      const contentType = stored.contentType || ttsContentTypeFor(format);
      return new Response(stored.body, {
        status: 200,
        headers: audioCacheHeaders(contentType),
      });
    });
}

export { TtsProviderError };
