import { requireRequestStore } from '@libs/app-shared/request-scope';
import { appAuth } from '@libs/auth-shared/auth-context';
import {
  PuzzleLoadAlreadyRunningError,
  PuzzleLoadJobService,
} from '@libs/chess-puzzle-server/puzzle-load-job';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { requirePermission } from '@libs/permissions-shared/require-permission';
import { assert } from '@pkgs/assert-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

async function authorizedService(clock: Clock, createId: CreateId, req: Request) {
  const store = requireRequestStore();
  const context = await store.sessionAuth.resolveAuthContext(store.sqlClient, req);
  const auth = appAuth(context);
  await requirePermission({
    db: store.sqlClient,
    auth,
    permission: PERMISSION.puzzlesManage,
    nowMs: clock.now(),
  });
  assert.defined(auth, 'puzzle management auth missing');
  assert.defined(auth.accountId, 'puzzle management account missing');
  return {
    actorId: auth.accountId,
    service: new PuzzleLoadJobService(
      store.sqlClient,
      store.objectStore,
      clock,
      createId
    ),
  };
}

export function createPuzzleManagementApp(clock: Clock, createId: CreateId) {
  return new Hono()
    .get('/puzzle-management/job', async (c) => {
      const { service } = await authorizedService(clock, createId, c.req.raw);
      return c.json({ job: await service.latest() });
    })
    .post('/puzzle-management/job', async (c) => {
      const { actorId, service } = await authorizedService(
        clock,
        createId,
        c.req.raw
      );
      try {
        return c.json({ job: await service.run(actorId) }, 201);
      } catch (error) {
        if (error instanceof PuzzleLoadAlreadyRunningError) {
          throw new HTTPException(409, {
            message: 'A puzzle load is already running',
          });
        }
        throw error;
      }
    });
}
