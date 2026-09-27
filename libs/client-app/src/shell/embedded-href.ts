/**
 * Persist the embedded MemoryRouter location in client Kv so simulator
 * remounts / snapshot restores reopen on the same path.
 */

import { asKeyword } from '@pkgs/keyword/keyword';
import type { Kv } from '@pkgs/kv/interface';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';

const EMBEDDED_HREF_ROW_KEY = asKeyword('client.shell/embedded-href');
const EMBEDDED_HREF_VALUE_ATTR = asKeyword('client.shell/value');

function isHref(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('/');
}

const EMBEDDED_HREF_CODEC = jsonKvCodec(EMBEDDED_HREF_VALUE_ATTR, isHref);

/** Read the last embedded href, or `null` when missing / malformed. */
export async function readEmbeddedHref(kv: Kv): Promise<string | null> {
  const record = await kv.get(EMBEDDED_HREF_ROW_KEY);
  if (record === null) return null;
  return EMBEDDED_HREF_CODEC.decode(record) ?? null;
}

/** Upsert the embedded href for the next spawn / remount. */
export async function writeEmbeddedHref(kv: Kv, href: string): Promise<void> {
  if (!isHref(href)) return;
  await kv.put(EMBEDDED_HREF_ROW_KEY, EMBEDDED_HREF_CODEC.encode(href));
}
