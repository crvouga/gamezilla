import { assert } from '@pkgs/assert';
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
  NDJSON_CONTENT_TYPE,
  NdjsonStreamDecoder,
  type NdjsonReadFrame,
} from './ndjson';
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

function throwHttpFailure(res: Response, text: string): never {
  if (res.status === 401 || res.status === 403) {
    throw new PatchDbTransportRejectedError(res.status, text);
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

type NdjsonReadError = {
  readonly status: number;
  readonly message: string;
  readonly index: number;
};

type NdjsonReadState = {
  results: (PatchDbResult | undefined)[];
  firstError: NdjsonReadError | null;
  sawEnd: boolean;
};

function createNdjsonReadState(expected: number): NdjsonReadState {
  return {
    results: new Array<PatchDbResult | undefined>(expected).fill(undefined),
    firstError: null,
    sawEnd: false,
  };
}

function applyNdjsonFrame(
  frame: NdjsonReadFrame,
  state: NdjsonReadState,
  expected: number
): void {
  assert.ok(
    !state.sawEnd,
    'patch-db ndjson: frame received after end marker',
    { frameKind: frame.frame }
  );
  if (frame.frame === 'end') {
    state.sawEnd = true;
    return;
  }
  if (frame.frame === 'error') {
    if (state.firstError === null) {
      state.firstError = {
        status: frame.status,
        message: frame.message,
        index: frame.index,
      };
    }
    return;
  }
  assert.ok(
    frame.index >= 0 && frame.index < expected,
    'patch-db ndjson: result frame index out of range',
    { index: frame.index, expected }
  );
  state.results[frame.index] = frame.result as PatchDbResult;
}

async function readAllFrames(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  state: NdjsonReadState,
  expected: number
): Promise<void> {
  const decoder = new NdjsonStreamDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    const frames = decoder.push(value ?? new Uint8Array(0), done === true);
    for (const frame of frames) applyNdjsonFrame(frame, state, expected);
    if (done) return;
  }
}

function finalizeNdjsonReadState(
  state: NdjsonReadState,
  expected: number
): PatchDbResult[] {
  if (state.firstError !== null) {
    const e = state.firstError;
    if (e.status === 401 || e.status === 403) {
      throw new PatchDbTransportRejectedError(e.status, e.message);
    }
    throw new Error(
      `patch-db ndjson: per-query error at index ${e.index}: ${e.message}`
    );
  }
  assert.ok(
    state.sawEnd,
    'patch-db ndjson: stream ended without `end` frame (truncated transport)',
    { expected }
  );
  const out: PatchDbResult[] = new Array<PatchDbResult>(expected);
  for (let i = 0; i < expected; i++) {
    const r = state.results[i];
    assert.ok(
      r !== undefined,
      'patch-db ndjson: server omitted a result frame',
      { index: i, expected }
    );
    out[i] = r;
  }
  assertWireReadResponse({ results: out });
  return out;
}

async function consumeNdjsonReadStream(
  res: Response,
  expected: number
): Promise<PatchDbResult[]> {
  const body = res.body;
  assert.ok(
    body !== null,
    'patch-db ndjson response missing body stream',
    { status: res.status, expected }
  );
  const state = createNdjsonReadState(expected);
  await readAllFrames(body.getReader(), state, expected);
  return finalizeNdjsonReadState(state, expected);
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
    const url = this.requestUrl(PATCH_SUFFIX_READ);
    const useStreaming = this.options?.useNdjsonStreaming !== false;
    const accept = useStreaming
      ? `${NDJSON_CONTENT_TYPE}, application/json`
      : 'application/json';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: accept,
        ...NO_CACHE_REQUEST_HEADERS,
        ...(this.options?.getHeaders?.() ?? {}),
      },
      body: JSON.stringify({ queries }),
    });
    if (!res.ok) {
      const text = await res.text();
      throwHttpFailure(res, text);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes(NDJSON_CONTENT_TYPE)) {
      return consumeNdjsonReadStream(res, queries.length);
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
