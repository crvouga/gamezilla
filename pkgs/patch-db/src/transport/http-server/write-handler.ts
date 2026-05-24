import { Assert } from '@pkgs/assert';
import type { Context } from 'hono';
import { assertWirePatchInput, type PatchInput } from '../../interface';
import type { PatchDbSyncHost } from '../interface';
import type { PatchDbHttpAuthOptions } from './auth';
import { resolveRequestContext } from './auth';
import { applyNoCacheHeaders } from './no-cache';

export async function writeHandler(
  c: Context,
  host: PatchDbSyncHost,
  auth: PatchDbHttpAuthOptions | undefined
): Promise<Response> {
  const authResult = await resolveRequestContext(c, auth);
  if (!authResult.ok) {
    return c.json({ error: authResult.message }, authResult.status);
  }
  const bodyRaw: unknown = (c.req as { valid: (k: 'json') => unknown }).valid(
    'json'
  );
  const a: Assert = Assert.validation();
  a.record(bodyRaw, 'Request body must be object');
  const body = bodyRaw as { patches?: unknown };
  a.field(body, 'patches', 'patches required');
  a.array(body.patches, 'patches required');
  a.ok((body.patches as unknown[]).length > 0, 'patches must not be empty');
  a.all(body.patches as unknown[], (p): asserts p is PatchInput =>
    assertWirePatchInput(a, p)
  );
  const out = await host.write(body.patches as PatchInput[], authResult.ctx);
  applyNoCacheHeaders(c);
  return c.json(
    {
      accepted: out.accepted,
      rejected: out.rejected,
    },
    200
  );
}
