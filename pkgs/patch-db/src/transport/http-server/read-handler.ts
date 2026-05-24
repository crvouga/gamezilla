import { Assert } from '@pkgs/assert';
import type { Context } from 'hono';
import { assertQuery, type PatchDbQuery } from '../../interface';
import type { PatchDbSyncHost } from '../interface';
import type { PatchDbHttpAuthOptions } from './auth';
import { resolveRequestContext } from './auth';
import { jsonReadResponse } from './json-read-response';
import { clientWantsNdjson, ndjsonReadResponse } from './ndjson-read-response';

function assertReadBody(body: unknown): asserts body is {
  queries: PatchDbQuery[];
} {
  const a: Assert = Assert.validation();
  a.record(body, 'Request body must be object');
  const b = body as { queries?: unknown };
  a.field(b, 'queries', 'queries required');
  a.array(b.queries, 'queries required');
  a.ok((b.queries as unknown[]).length > 0, 'queries must not be empty');
  a.all(b.queries as unknown[], (q): asserts q is PatchDbQuery =>
    assertQuery(a, q)
  );
}

export async function readHandler(
  c: Context,
  host: PatchDbSyncHost,
  auth: PatchDbHttpAuthOptions | undefined
): Promise<Response> {
  const authResult = await resolveRequestContext(c, auth);
  if (!authResult.ok) {
    return c.json({ error: authResult.message }, authResult.status);
  }
  const body: unknown = (c.req as { valid: (k: 'json') => unknown }).valid(
    'json'
  );
  assertReadBody(body);
  const { queries } = body;
  if (clientWantsNdjson(c)) {
    return ndjsonReadResponse(c, host, queries, authResult.ctx);
  }
  return jsonReadResponse(c, host, queries, authResult.ctx);
}
