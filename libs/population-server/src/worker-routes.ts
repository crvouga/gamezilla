import { zValidator } from '@hono/zod-validator';
import { applicationEventSchema } from '@libs/population-shared/application-events';
import { checkpointSchema } from '@libs/population-shared/config';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { LeaseRepository } from './lease-repository';
import { PopulationController } from './population-controller';
import { PopulationSession } from './population-session';
import {
  leaseSchema,
  type PopulationPorts,
  workerHeartbeatSchema,
} from './records';

export type WorkerRouteDeps = {
  getDb: () => SqlClient;
  ports: PopulationPorts;
  credentialSecret: () => Promise<string>;
  authorize: (request: Request) => Promise<void>;
  bindAccount: (
    lease: z.infer<typeof leaseSchema>,
    token: string
  ) => Promise<boolean>;
};
const checkpointInput = leaseSchema.extend({
  checkpoint: checkpointSchema,
  version: z.string().max(128),
  action: z.string().max(256).nullable(),
  error: z.string().max(512).nullable(),
});

export function createPopulationWorkerRoutes(deps: WorkerRouteDeps) {
  const sessions = () => new PopulationSession(deps.getDb(), deps.ports);
  return new Hono()
    .use('*', bodyLimit({ maxSize: 300_000 }))
    .use('*', async (c, next) => {
      await deps.authorize(c.req.raw);
      await next();
    })
    .post('/heartbeat', zValidator('json', workerHeartbeatSchema), async (c) =>
      c.json({
        config: await new PopulationController(
          deps.getDb(),
          deps.ports,
          await deps.credentialSecret()
        ).heartbeat(c.req.valid('json')),
      })
    )
    .post(
      '/claim',
      zValidator('json', z.object({ workerId: z.string().uuid() })),
      async (c) =>
        c.json({
          assignment: await new PopulationController(
            deps.getDb(),
            deps.ports,
            await deps.credentialSecret()
          ).claim(c.req.valid('json').workerId),
        })
    )
    .post('/renew', zValidator('json', leaseSchema), async (c) => {
      const renewal = await sessions().renew(c.req.valid('json'));
      return renewal === null
        ? c.json({ error: 'Worker Lease expired or replaced' }, 409)
        : c.json({ renewal });
    })
    .post(
      '/bind-account',
      zValidator(
        'json',
        leaseSchema.extend({ token: z.string().min(1).max(4096) })
      ),
      async (c) => {
        const input = c.req.valid('json');
        const accepted = await deps.bindAccount(input, input.token);
        return accepted
          ? c.json({ accepted: true as const })
          : c.json({ error: 'Identity or ownership did not match' }, 409);
      }
    )
    .post('/checkpoint', zValidator('json', checkpointInput), async (c) => {
      const input = c.req.valid('json');
      const accepted = await sessions().checkpoint(input);
      return accepted
        ? c.json({ accepted: true as const })
        : c.json({ error: 'Worker Lease expired or replaced' }, 409);
    })
    .route('/', createSessionRecordingRoutes(deps));
}
function createSessionRecordingRoutes(deps: WorkerRouteDeps) {
  const sessions = () => new PopulationSession(deps.getDb(), deps.ports);
  const leases = () => new LeaseRepository(deps.getDb(), deps.ports);
  return new Hono()
    .post(
      '/events',
      zValidator(
        'json',
        leaseSchema.extend({
          version: z.string().max(128),
          ...applicationEventSchema.omit({ activity: true }).shape,
        })
      ),
      async (c) =>
        c.json({ accepted: await sessions().event(c.req.valid('json')) })
    )
    .post('/release', zValidator('json', leaseSchema), async (c) =>
      c.json({ released: await leases().release(c.req.valid('json')) })
    )
    .post(
      '/complete-command',
      zValidator(
        'json',
        leaseSchema.extend({ operationId: z.string().uuid() })
      ),
      async (c) =>
        c.json({
          accepted: await sessions().completeCommand(
            c.req.valid('json'),
            c.req.valid('json').operationId
          ),
        })
    )
    .post(
      '/inspection',
      zValidator(
        'json',
        leaseSchema.extend({ requestedAt: z.string(), snapshot: z.unknown() })
      ),
      async (c) =>
        c.json({
          accepted: await sessions().inspection(
            c.req.valid('json'),
            c.req.valid('json').requestedAt,
            c.req.valid('json').snapshot
          ),
        })
    );
}
export type PopulationWorkerRPC = ReturnType<
  typeof createPopulationWorkerRoutes
>;
