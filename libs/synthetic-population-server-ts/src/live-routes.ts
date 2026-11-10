import { zValidator } from '@hono/zod-validator';
import {
  LIVE_FRAME_MAX_CHARS,
  liveFrameSchema,
  liveHeartbeatSchema,
} from '@libs/synthetic-population-shared-ts/live-session';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { LiveObservatory, type LiveObservatoryPorts } from './live-observatory';
import type { LiveDevice } from './live-sessions';

export type LiveReportRouteDeps = {
  readonly getDb: () => SqlClient;
  readonly ports: LiveObservatoryPorts;
  /** The app's own account and device, from its authenticated request. */
  readonly identify: (request: Request) => Promise<LiveDevice | null>;
};

/**
 * Telemetry ingestion from every open app: its heartbeat, its closing, and,
 * only while it is watched live, sanitized pictures of its screen. Each app
 * reports only about itself; the server decides who it is.
 */
export function createLiveReportRoutes(deps: LiveReportRouteDeps) {
  const live = () => new LiveObservatory(deps.getDb(), deps.ports);
  const device = async (request: Request) => deps.identify(request);
  return new Hono()
    .use('*', bodyLimit({ maxSize: LIVE_FRAME_MAX_CHARS * 2 + 1024 }))
    .post('/heartbeat', zValidator('json', liveHeartbeatSchema), async (c) => {
      const app = await device(c.req.raw);
      if (app === null) return c.json({ error: 'Sign-in required' }, 401);
      return c.json(await live().heartbeat(app, c.req.valid('json')));
    })
    .post('/end', async (c) => {
      const app = await device(c.req.raw);
      if (app === null) return c.json({ error: 'Sign-in required' }, 401);
      await live().end(app);
      return c.json({ ended: true as const });
    })
    .post('/frame', zValidator('json', liveFrameSchema), async (c) => {
      const app = await device(c.req.raw);
      if (app === null) return c.json({ error: 'Sign-in required' }, 401);
      return c.json({ kept: await live().frame(app, c.req.valid('json')) });
    });
}

export type SyntheticPopulationLiveRPC = ReturnType<
  typeof createLiveReportRoutes
>;
