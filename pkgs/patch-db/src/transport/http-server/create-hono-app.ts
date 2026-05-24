import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { PatchDbSyncHost } from '../interface';
import { PATCH_SUFFIX_READ, PATCH_SUFFIX_WRITE } from '../paths';
import { patchDbReadBodySchema, patchDbWriteBodySchema } from '../wire-schemas';
import type { PatchDbHttpAuthOptions } from './auth';
import { readHandler } from './read-handler';
import { writeHandler } from './write-handler';

/**
 * Hono sub-app routes (paths relative to {@link patchDbPaths} `basePath` mount).
 * Matches wire URLs `{base}/patches/read` and `{base}/patches/write`.
 */
export function createPatchDbHttpHono(
  host: PatchDbSyncHost,
  auth?: PatchDbHttpAuthOptions
) {
  return new Hono()
    .post(
      PATCH_SUFFIX_READ,
      zValidator('json', patchDbReadBodySchema),
      async (c) => readHandler(c, host, auth)
    )
    .post(
      PATCH_SUFFIX_WRITE,
      zValidator('json', patchDbWriteBodySchema),
      async (c) => writeHandler(c, host, auth)
    );
}
