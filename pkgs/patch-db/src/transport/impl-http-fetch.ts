import { assert, AssertCrashError } from '@pkgs/assert';
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
import { shouldAssertOnPatchDbHttpServerError } from './http-server-error-assert';
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

function throwHttpFailure(res: Response, text: string): never {
  if (res.status === 401 || res.status === 403) {
    throw new PatchDbTransportRejectedError(res.status, text);
  }
  // Server `assertCrash` JSON bodies re-raise locally so the registered crash
  // handler chain runs before the promise rejects with the original message.
  const parsed = parseAssertCrashBody(text);
  if (parsed !== null) {
    dispatchAssertCrash(parsed.message, parsed.context);
    throw new AssertCrashError(parsed.message, parsed.context);
  }
  if (res.status === 500 && shouldAssertOnPatchDbHttpServerError()) {
    const message = `patch-db sync HTTP ${res.status}: ${text.slice(0, 512)}`;
    dispatchAssertCrash(message, {
      status: res.status,
      body: text.slice(0, 2048),
    });
    throw new AssertCrashError(message, { status: res.status });
  }
  throw new Error(`HTTP ${res.status}: ${text}`);
}

export type PatchDbClientTransportHttpFetchOptions = {
  /** Extra headers (e.g. `Authorization: Bearer …`) for authenticated patch-db API. */
  getHeaders?: () => Record<string, string>;
};

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

function jsonHeaders(
  options: PatchDbClientTransportHttpFetchOptions | undefined
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...NO_CACHE_REQUEST_HEADERS,
    ...(options?.getHeaders?.() ?? {}),
  };
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
      headers: jsonHeaders(this.options),
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) {
      const text = await res.text();
      throwHttpFailure(res, text);
    }
    const raw: unknown = await res.json();
    assertWireReadResponse(raw);
    return raw.results;
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
      headers: jsonHeaders(this.options),
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
