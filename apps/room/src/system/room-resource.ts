/**
 * Product `room` resource implement — in-memory Room fetch façade for DST.
 * Prod stays on Durable Objects via {@link ../room.ts}.
 */

import { room } from '@libs/runtime/shared/system';
import { asKeyword, asKeywordRecord } from '@pkgs/keyword/keyword';
import { serveFetch } from '@pkgs/system';

const VALUE_KEY = asKeyword('room/value');
const TEXT_ATTR = asKeyword('room/text');

export const roomResource = room.implement((deps) => {
  return serveFetch(async (req) => {
    const url = new URL(req.url);
    const isSet =
      req.method === 'POST' ||
      url.pathname.endsWith('/set') ||
      url.searchParams.get('op') === 'set';
    if (isSet) {
      const text = await req.text();
      await deps.storage.put(
        VALUE_KEY,
        asKeywordRecord({ 'room/text': text }, 'room value')
      );
      return new Response('ok');
    }
    const row = await deps.storage.get(VALUE_KEY);
    const text =
      row && typeof row[TEXT_ATTR] === 'string' ? String(row[TEXT_ATTR]) : '';
    return new Response(text);
  });
});
