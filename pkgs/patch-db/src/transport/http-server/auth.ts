import { Assert } from '@pkgs/assert';
import type { Context } from 'hono';
import { ForbiddenError } from '../../forbidden-error';
import {
  OPEN_PATCHES_DB_CONTEXT,
  assertPatchDbContext,
  type PatchDbContext,
} from '../../interface';

export type PatchDbHttpAuthOptions = {
  resolvePatchDbContext?: (
    req: Request
  ) => Promise<PatchDbContext | null | undefined>;
  /** When true, missing / null context from resolver yields 401. */
  requirePatchDbAuth?: boolean;
};

export type ResolvedRequestContext =
  | { ok: true; ctx: PatchDbContext }
  | { ok: false; status: 401 | 403; message: string };

export async function resolveRequestContext(
  c: Context,
  auth: PatchDbHttpAuthOptions | undefined
): Promise<ResolvedRequestContext> {
  const resolve = auth?.resolvePatchDbContext;
  if (resolve === undefined) {
    return { ok: true, ctx: OPEN_PATCHES_DB_CONTEXT };
  }
  try {
    const resolved = await resolve(c.req.raw);
    if (resolved === null || resolved === undefined) {
      if (auth?.requirePatchDbAuth === true) {
        return { ok: false, status: 401, message: 'Unauthorized' };
      }
      return { ok: true, ctx: OPEN_PATCHES_DB_CONTEXT };
    }
    assertPatchDbContext(resolved, Assert.validation());
    return { ok: true, ctx: resolved };
  } catch (e: unknown) {
    if (e instanceof ForbiddenError) {
      return { ok: false, status: 403, message: e.message };
    }
    throw e;
  }
}
