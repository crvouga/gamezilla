import { assert } from '@gamezilla/shared/assert';
import { assertUrl } from '../assert-url';
import type {
  Patch,
  PatchesDbQuery,
  PatchesDbResult,
  PatchInput,
} from '../interface';
import { assertPatches, assertPatchesDbResults } from '../validate-remote';
import type { PatchDbClientTransport } from './interface';
import {
  NO_CACHE_REQUEST_HEADERS,
  PATCH_SUFFIX_READ,
  PATCH_SUFFIX_WRITE,
} from './paths';

export class PatchDbClientTransportHttpFetch implements PatchDbClientTransport {
  constructor(private baseUrl: string) {
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

  async read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]> {
    if (queries.length === 0) return [];
    const url = this.requestUrl(PATCH_SUFFIX_READ);
    const encoded = encodeURIComponent(JSON.stringify({ queries }));
    const res = await fetch(`${url}?q=${encoded}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...NO_CACHE_REQUEST_HEADERS,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const raw: unknown = await res.json();
    assertPatchesDbResults(raw);
    return raw;
  }

  async write(patches: PatchInput[]): Promise<Patch[]> {
    const url = this.requestUrl(PATCH_SUFFIX_WRITE);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...NO_CACHE_REQUEST_HEADERS,
      },
      body: JSON.stringify({ patches }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const raw: unknown = await res.json();
    assertPatches(raw);
    return raw;
  }
}
