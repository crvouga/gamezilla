import { requireRequestStore } from '@libs/app-root-shared/request-scope';
import { appAuth } from '@libs/auth-shared/auth-context';
import { SavedPuzzleSourceStore } from '@libs/chess-puzzle-server/saved-puzzle-source';
import {
  PUZZLE_UPLOAD_MAX_BYTES,
  PUZZLE_UPLOAD_MAX_CHUNKS,
  puzzleSourcePartKey,
} from '@libs/chess-puzzle-shared/puzzle-load-job';
import {
  puzzleSourceIdSchema,
  savedPuzzleSourceSchema,
} from '@libs/chess-puzzle-shared/puzzle-source';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { requirePermission } from '@libs/permissions-shared/require-permission';
import type { Clock } from '@pkgs/clock-shared/types';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';

/** External file bytes and metadata only. Environment writes remain mutations. */
export function createPuzzleManagementApp(clock: Clock) {
  const app = new Hono();
  app.use('/puzzle-management/*', async (c, next) => {
    const store = requireRequestStore();
    const context = await store.sessionAuth.resolveAuthContext(
      store.sqlClient,
      c.req.raw
    );
    await requirePermission({
      db: store.sqlClient,
      auth: appAuth(context),
      permission: PERMISSION.puzzlesManage,
      nowMs: clock.now(),
    });
    await next();
  });
  app.get('/puzzle-management/source', async (c) => {
    const source = await new SavedPuzzleSourceStore(
      requireRequestStore().objectStore
    ).read();
    return c.json({ source });
  });
  app.post(
    '/puzzle-management/source',
    bodyLimit({ maxSize: 4096 }),
    async (c) => {
      const parsed = savedPuzzleSourceSchema.safeParse(await c.req.json());
      if (!parsed.success)
        throw new HTTPException(400, {
          message: 'Invalid Lichess file details.',
        });
      const source = await new SavedPuzzleSourceStore(
        requireRequestStore().objectStore
      ).save(parsed.data);
      return c.json({ source });
    }
  );
  app.put(
    '/puzzle-management/source/:sourceId/:part',
    bodyLimit({ maxSize: PUZZLE_UPLOAD_MAX_BYTES }),
    async (c) => {
      const store = requireRequestStore().objectStore;
      const id = puzzleSourceIdSchema.safeParse(c.req.param('sourceId'));
      const part = Number(c.req.param('part'));
      if (
        !id.success ||
        !Number.isInteger(part) ||
        part < 0 ||
        part >= PUZZLE_UPLOAD_MAX_CHUNKS
      )
        throw new HTTPException(400, {
          message: 'Invalid puzzle source part.',
        });
      if (part === 0 && (await new SavedPuzzleSourceStore(store).read()))
        throw new HTTPException(409, {
          message:
            'The Lichess file is already saved. Load the saved file instead.',
        });
      const key = puzzleSourcePartKey(id.data, part);
      if (await store.head(key))
        throw new HTTPException(409, {
          message: 'This source part was already uploaded.',
        });
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      if (bytes.byteLength === 0)
        throw new HTTPException(400, {
          message: 'The CSV source part is empty.',
        });
      await store.put(key, bytes, 'text/csv');
      return c.body(null, 201);
    }
  );
  return app;
}
