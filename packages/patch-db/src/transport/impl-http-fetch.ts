import { assert } from '@gamezilla/assert';
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

function throwHttpFailure(res: Response, text: string): never {
  if (res.status === 401 || res.status === 403) {
    throw new PatchDbTransportRejectedError(res.status, text);
  }
  throw new Error(`HTTP ${res.status}: ${text}`);
}

export type PatchDbClientTransportHttpFetchOptions = {
  /** Extra headers (e.g. `Authorization: Bearer …`) for authenticated patch-db API. */
  getHeaders?: () => Record<string, string>;
};

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
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...NO_CACHE_REQUEST_HEADERS,
        ...(this.options?.getHeaders?.() ?? {}),
      },
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
