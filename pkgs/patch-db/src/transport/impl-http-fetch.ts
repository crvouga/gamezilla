import { assert, AssertCrashError } from '@pkgs/assert';
import {
  collectIndexedNdjsonStream,
  IndexedNdjsonStreamError,
  ndjsonAcceptHeader,
} from '@pkgs/ndjson/client';
import { NDJSON_CONTENT_TYPE } from '@pkgs/ndjson/shared';
import { assertUrl } from '../assert-url';
import type {
  PatchDbContext,
  PatchDbQuery,
  PatchDbResult,
  PatchInput,
  WritePatchesResult,
} from '../interface';
import {
  assertWireReadResponse,
  assertWireWriteResponse,
} from '../validate-remote';
import type { PatchDbClientTransport } from './interface';
import {
  NO_CACHE_REQUEST_HEADERS,
  PATCH_SUFFIX_READ,
  PATCH_SUFFIX_WRITE,
} from './paths';
import { PatchDbTransportRejectedError } from './transport-rejected-error';
import {
  MAX_PATCHES_PER_REQUEST,
  MAX_QUERIES_PER_REQUEST,
} from './wire-schemas';

function parseAssertCrashBody(
  text: string
): { message: string; context?: Record<string, unknown> } | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (o['kind'] !== 'assertCrash') return null;
    if (typeof o['error'] !== 'string') return null;
    const ctx = o['context'];
    return {
      message: o['error'],
      ...(ctx !== null && typeof ctx === 'object'
        ? { context: ctx as Record<string, unknown> }
        : {}),
    };
  } catch {
    return null;
  }
}

function throwHttpFailure(res: Response, text: string): never {
  if (res.status === 401 || res.status === 403) {
    throw new PatchDbTransportRejectedError(res.status, text);
  }
  // Flat-JSON `assertCrash` path mirrors the NDJSON one: re-raise the same
  // crash locally (so the registered handler chain runs) before rejecting
  // the promise with the original message + context.
  const parsed = parseAssertCrashBody(text);
  if (parsed !== null) {
    dispatchAssertCrash(parsed.message, parsed.context);
    throw new AssertCrashError(parsed.message, parsed.context);
  }
  throw new Error(`HTTP ${res.status}: ${text}`);
}

export type PatchDbClientTransportHttpFetchOptions = {
  /** Extra headers (e.g. `Authorization: Bearer …`) for authenticated patch-db API. */
  getHeaders?: () => Record<string, string>;
  /**
   * When `true` (default), the client sends `Accept: application/x-ndjson`
   * on `/patches/read` and parses the streaming NDJSON response. The
   * server still falls back to the flat `application/json` response when
   * this header is absent, so deployments with mixed client / server
   * versions stay compatible.
   *
   * Disable only for debugging or when the client runtime cannot consume
   * `ReadableStream` bodies.
   */
  useNdjsonStreaming?: boolean;
};

/**
 * Run the registered crash-handler chain with the given message + context,
 * mirroring an `assert.crash` invocation. Wrapped (instead of calling
 * `assert.ok(false, ...)` inline) so the `asserts condition` signature on
 * `assert.ok` does not collapse control flow at the call site — the browser
 * `BrowserCrashHandler` returns synchronously after showing the overlay,
 * and callers still want to throw / record an error after dispatch so the
 * promise rejects deterministically.
 */
function dispatchAssertCrash(
  message: string,
  context?: Record<string, unknown>
): void {
  const ok: boolean = false;
  assert.ok(ok, message, context);
}

/**
 * Map an {@link IndexedNdjsonStreamError} from the generic NDJSON consumer
 * to a patch-db-specific failure. Auth rejections become
 * {@link PatchDbTransportRejectedError}; server-side `assert.crash`
 * invocations are re-raised through the local crash-handler chain (so the
 * overlay / telemetry observe the original message + context) before
 * being thrown as {@link AssertCrashError}.
 */
function throwFromStreamError(e: IndexedNdjsonStreamError): never {
  if (e.status === 401 || e.status === 403) {
    throw new PatchDbTransportRejectedError(e.status, e.message);
  }
  if (e.kind === 'assertCrash') {
    // Preserve the original assert message + context as-is so the rejected
    // promise's `.message` matches what the crash handler overlay rendered
    // — wrapping it would diverge the two surfaces.
    throw new AssertCrashError(e.message, e.context);
  }
  throw new Error(
    `patch-db ndjson: per-query error at index ${e.index}: ${e.message}`
  );
}

function assertReadQueriesSupported(queries: PatchDbQuery[]): void {
  if (queries.length === 0) {
    throw new Error(
      'PatchDbClientTransportHttpFetch.read: empty queries are unsupported over HTTP; read locally instead'
    );
  }
  assert.ok(
    queries.length <= MAX_QUERIES_PER_REQUEST,
    'patch-db client must chunk reads to fit MAX_QUERIES_PER_REQUEST; sending an over-sized batch is a programmer error',
    {
      queriesLength: queries.length,
      max: MAX_QUERIES_PER_REQUEST,
    }
  );
}

function readRequestHeaders(
  options: PatchDbClientTransportHttpFetchOptions | undefined
): Record<string, string> {
  const useStreaming = options?.useNdjsonStreaming ?? true;
  const accept = useStreaming ? ndjsonAcceptHeader() : 'application/json';

  return {
    'Content-Type': 'application/json',
    Accept: accept,
    ...NO_CACHE_REQUEST_HEADERS,
    ...(options?.getHeaders?.() ?? {}),
  };
}

async function parseReadResponse(
  res: Response,
  expectedQueryCount: number
): Promise<PatchDbResult[]> {
  if (!res.ok) {
    const text = await res.text();
    throwHttpFailure(res, text);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes(NDJSON_CONTENT_TYPE)) {
    return consumeNdjsonReadStream(res, expectedQueryCount);
  }
  const raw: unknown = await res.json();
  assertWireReadResponse(raw);
  return raw.results;
}

async function consumeNdjsonReadStream(
  res: Response,
  expected: number
): Promise<PatchDbResult[]> {
  let results: PatchDbResult[];
  try {
    results = await collectIndexedNdjsonStream<PatchDbResult>(
      res.body,
      expected,
      {
        // Re-raise server-side assert crashes locally as soon as they
        // arrive so the crash-handler chain (overlay, telemetry) runs
        // with the original message + context. Subsequent finalize()
        // still throws IndexedNdjsonStreamError so the promise rejects.
        onErrorFrame: (frame) => {
          if (frame.kind === 'assertCrash') {
            dispatchAssertCrash(frame.message, frame.context);
          }
        },
      }
    );
  } catch (e: unknown) {
    if (e instanceof IndexedNdjsonStreamError) throwFromStreamError(e);
    throw e;
  }
  assertWireReadResponse({ results });
  return results;
}

export class PatchDbClientTransportHttpFetch implements PatchDbClientTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly options?: PatchDbClientTransportHttpFetchOptions
  ) {
    assertUrl(baseUrl);
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

  async read(
    queries: PatchDbQuery[],
    _ctx?: PatchDbContext
  ): Promise<PatchDbResult[]> {
    void _ctx;
    assertReadQueriesSupported(queries);
    const url = this.requestUrl(PATCH_SUFFIX_READ);
    const res = await fetch(url, {
      method: 'POST',
      headers: readRequestHeaders(this.options),
      body: JSON.stringify({ queries }),
    });
    return parseReadResponse(res, queries.length);
  }

  async write(
    patches: PatchInput[],
    _ctx?: PatchDbContext
  ): Promise<WritePatchesResult> {
    void _ctx;
    assert.ok(
      patches.length > 0,
      'patch-db client must not call write([]); empty pushes waste a round trip and violate the wire contract',
      { patchesLength: patches.length }
    );
    assert.ok(
      patches.length <= MAX_PATCHES_PER_REQUEST,
      'patch-db client must chunk pushes to fit MAX_PATCHES_PER_REQUEST; sending an over-sized batch is a programmer error',
      {
        patchesLength: patches.length,
        max: MAX_PATCHES_PER_REQUEST,
      }
    );
    const url = this.requestUrl(PATCH_SUFFIX_WRITE);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...NO_CACHE_REQUEST_HEADERS,
        ...(this.options?.getHeaders?.() ?? {}),
      },
      body: JSON.stringify({ patches }),
    });
    if (!res.ok) {
      const text = await res.text();
      throwHttpFailure(res, text);
    }
    const raw: unknown = await res.json();
    assertWireWriteResponse(raw);
    return raw;
  }
}
