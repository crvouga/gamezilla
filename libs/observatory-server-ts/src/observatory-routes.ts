import { zValidator } from '@hono/zod-validator';
import { onlineNowFilterSchema } from '@libs/observatory-shared-ts/live-session';
import {
  type AppPermission,
  PERMISSION,
} from '@libs/permissions-shared-ts/permission-catalog';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { ObservatoryPorts } from './ports';
import { UserObservatory } from './user-observatory';

export type ObservatoryRouteDeps = {
  readonly getDb: () => SqlClient;
  readonly ports: ObservatoryPorts;
  readonly subscriptionCredentials: (
    actorId: string
  ) => Promise<{ username: string; password: string; expiresAt: number }>;
  /** The authorized actor's id; throws when the permission is denied. */
  readonly authorize: (
    request: Request,
    permission: AppPermission
  ) => Promise<string>;
};
const sessionParam = z.object({ id: z.string().uuid() });
const onlineNowQuery = z.object({
  filter: onlineNowFilterSchema.default('everyone'),
});

/**
 * The User Observatory's reads: whoever is online now, watching one of them
 * live, and the credentials to hear when either changes.
 */
export function createObservatoryRoutes(deps: ObservatoryRouteDeps) {
  const observatory = () => new UserObservatory(deps.getDb(), deps.ports);
  return new Hono()
    .use('*', bodyLimit({ maxSize: 16_384 }))
    .get('/subscription', async (c) => {
      const actorId = await deps.authorize(
        c.req.raw,
        PERMISSION.observatoryView
      );
      return c.json(await deps.subscriptionCredentials(actorId));
    })
    .get('/live', zValidator('query', onlineNowQuery), async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.observatoryView);
      return c.json({
        entries: await observatory().onlineNow(c.req.valid('query').filter),
        observedAtMs: deps.ports.clock.now(),
      });
    })
    .post('/live/:id/watch', zValidator('param', sessionParam), async (c) => {
      const actorId = await deps.authorize(
        c.req.raw,
        PERMISSION.observatoryWatch
      );
      return c.json(
        await observatory().watch(c.req.valid('param').id, actorId)
      );
    });
}

export type ObservatoryRPC = ReturnType<typeof createObservatoryRoutes>;
