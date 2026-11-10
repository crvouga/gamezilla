import { zValidator } from '@hono/zod-validator';
import { applicationEventSchema } from '@libs/synthetic-population-shared-ts/application-events';
import { checkpointSchema } from '@libs/synthetic-population-shared-ts/config';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { LeaseRepository } from './lease-repository';
import {
  leaseSchema,
  type SyntheticPopulationPorts,
  workerHeartbeatSchema,
} from './records';
import { SignInInbox } from './sign-in-inbox';
import { SyntheticPopulationController } from './synthetic-population-controller';
import { SyntheticPopulationSession } from './synthetic-population-session';
import { renewSyntheticUser } from './synthetic-user-renewal';

export type WorkerRouteDeps = {
  getDb: () => SqlClient;
  ports: SyntheticPopulationPorts;
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

const claimSchema = z.object({
  workerId: z.string().uuid(),
  /** The games the worker's Synthetic Users play, by registered game id. */
  games: z.array(z.string().min(1).max(64)).max(64).default([]),
  /** Synthetic Users whose devices on this worker have no connection. */
  unreachable: z.array(z.string().uuid()).max(1000).default([]),
});

export function createSyntheticPopulationWorkerRoutes(deps: WorkerRouteDeps) {
  const sessions = () =>
    new SyntheticPopulationSession(deps.getDb(), deps.ports);
  return new Hono()
    .use('*', bodyLimit({ maxSize: 300_000 }))
    .use('*', async (c, next) => {
      await deps.authorize(c.req.raw);
      await next();
    })
    .post(
      '/heartbeat',
      zValidator(
        'json',
        workerHeartbeatSchema.extend({
          /** The games the worker's Synthetic Users play, by registered game id. */
          games: z.array(z.string().min(1).max(64)).max(64).default([]),
        })
      ),
      async (c) => {
        const { games, ...heartbeat } = c.req.valid('json');
        return c.json({
          config: await new SyntheticPopulationController(
            deps.getDb(),
            deps.ports
          ).heartbeat(heartbeat, games),
        });
      }
    )
    .post('/claim', zValidator('json', claimSchema), async (c) =>
      c.json({
        assignment: await new SyntheticPopulationController(
          deps.getDb(),
          deps.ports
        ).claim(
          c.req.valid('json').workerId,
          c.req.valid('json').games,
          c.req.valid('json').unreachable
        ),
      })
    )
    .post('/renew', zValidator('json', leaseSchema), async (c) => {
      const renewal = await renewSyntheticUser(
        deps.getDb(),
        deps.ports,
        c.req.valid('json')
      );
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
    .route('/', createSignInRoutes(deps))
    .route('/', createSessionRecordingRoutes(deps));
}
/** The internal inbox has exactly one reader: the addressee's leased worker. */
function createSignInRoutes(deps: WorkerRouteDeps) {
  return new Hono().post(
    '/take-sign-in-link',
    zValidator('json', leaseSchema),
    async (c) => {
      const taken = await new SignInInbox(deps.getDb(), deps.ports).take(
        c.req.valid('json')
      );
      c.header('cache-control', 'no-store');
      return taken.owned
        ? c.json({ link: taken.link })
        : c.json({ error: 'Worker Lease expired or replaced' }, 409);
    }
  );
}
function createSessionRecordingRoutes(deps: WorkerRouteDeps) {
  const sessions = () =>
    new SyntheticPopulationSession(deps.getDb(), deps.ports);
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
export type SyntheticPopulationWorkerRPC = ReturnType<
  typeof createSyntheticPopulationWorkerRoutes
>;
