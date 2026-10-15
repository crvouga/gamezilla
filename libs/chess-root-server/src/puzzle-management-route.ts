import { requireRequestStore } from '@libs/app-root-shared/request-scope';
import { appAuth } from '@libs/auth-shared/auth-context';
import { puzzleUploadIdSchema } from '@libs/chess-puzzle-shared/puzzle-import-mutations';
import {
  PUZZLE_UPLOAD_MAX_BYTES,
  PUZZLE_UPLOAD_MAX_CHUNKS,
  puzzleUploadKey,
} from '@libs/chess-puzzle-shared/puzzle-load-job';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { requirePermission } from '@libs/permissions-shared/require-permission';
import { assert } from '@pkgs/assert-root-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';

/** This route stages external CSV bytes only. All domain writes are mutations. */
export function createPuzzleManagementApp(clock: Clock) {
  return new Hono().put(
    '/puzzle-management/source/:uploadId/:part',
    bodyLimit({ maxSize: PUZZLE_UPLOAD_MAX_BYTES }),
    async (c) => {
      const store = requireRequestStore();
      const context = await store.sessionAuth.resolveAuthContext(
        store.sqlClient,
        c.req.raw
      );
      const auth = appAuth(context);
      await requirePermission({
        db: store.sqlClient,
        auth,
        permission: PERMISSION.puzzlesManage,
        nowMs: clock.now(),
      });
      assert.defined(auth?.accountId, 'puzzle management account missing');
      const parsed = puzzleUploadIdSchema.safeParse(c.req.param('uploadId'));
      const part = Number(c.req.param('part'));
      if (
        !parsed.success ||
        !Number.isInteger(part) ||
        part < 0 ||
        part >= PUZZLE_UPLOAD_MAX_CHUNKS
      ) {
        throw new HTTPException(400, {
          message: 'Invalid puzzle source part.',
        });
      }
      const key = puzzleUploadKey(auth.accountId, parsed.data, part);
      if (await store.objectStore.head(key))
        throw new HTTPException(409, {
          message:
            'This source part was already uploaded. Select the file and start again.',
        });
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      if (bytes.byteLength === 0)
        throw new HTTPException(400, {
          message: 'The CSV source part is empty.',
        });
      await store.objectStore.put(key, bytes, 'text/csv');
      return c.body(null, 201);
    }
  );
}
