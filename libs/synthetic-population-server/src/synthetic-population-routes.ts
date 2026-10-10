import { zValidator } from '@hono/zod-validator';
import {
  type AppPermission,
  PERMISSION,
} from '@libs/permissions-shared/permission-catalog';
import {
  syntheticPopulationCommandSchema,
  syntheticPopulationConfigSchema,
} from '@libs/synthetic-population-shared/config';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { replaySyntheticPopulationDecisions } from './decision-replay';
import type { SyntheticPopulationPorts } from './records';
import { SyntheticPopulationAdministration } from './synthetic-population-administration';
import { SyntheticPopulationRepository } from './synthetic-population-repository';
import {
  readSyntheticPopulationDirectory,
  syntheticPopulationDirectoryQuery,
} from './synthetic-population-user-directory';

export type SyntheticPopulationRouteDeps = {
  readonly getDb: () => SqlClient;
  readonly ports: SyntheticPopulationPorts;
  readonly subscriptionCredentials: (
    actorId: string
  ) => Promise<{ username: string; password: string; expiresAt: number }>;
  readonly authorize: (
    request: Request,
    permission: AppPermission
  ) => Promise<string>;
};
const userParam = z.object({ id: z.string().uuid() });

export function createSyntheticPopulationRoutes(
  deps: SyntheticPopulationRouteDeps
) {
  const admin = () =>
    new SyntheticPopulationAdministration(deps.getDb(), deps.ports);
  const repo = () =>
    new SyntheticPopulationRepository(deps.getDb(), deps.ports);
  return new Hono()
    .use('*', bodyLimit({ maxSize: 16_384 }))
    .get('/subscription', async (c) => {
      const actorId = await deps.authorize(
        c.req.raw,
        PERMISSION.syntheticPopulationView
      );
      return c.json(await deps.subscriptionCredentials(actorId));
    })
    .get('/', async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.syntheticPopulationView);
      const result = await admin().overview();
      // Live DOM is a separately authorized, on-demand read.
      return c.json({
        ...result,
        users: result.users.map(({ inspection: _inspection, ...user }) => user),
      });
    })
    .get(
      '/users',
      zValidator('query', syntheticPopulationDirectoryQuery),
      async (c) => {
        await deps.authorize(c.req.raw, PERMISSION.syntheticPopulationView);
        return c.json(
          await readSyntheticPopulationDirectory(
            deps.getDb(),
            c.req.valid('query')
          )
        );
      }
    )
    .get('/workers', async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.syntheticPopulationView);
      return c.json({
        workers: await repo().workers(),
        observedAtMs: deps.ports.clock.now(),
      });
    })
    .get('/users/:id', zValidator('param', userParam), async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.syntheticPopulationInspect);
      const user = await repo().user(c.req.valid('param').id);
      return user === null
        ? c.json({ error: 'Synthetic User not found' }, 404)
        : c.json({ user });
    })
    .get('/users/:id/events', zValidator('param', userParam), async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.syntheticPopulationInspect);
      return c.json({ events: await repo().events(c.req.valid('param').id) });
    })
    .post('/users/:id/replay', zValidator('param', userParam), async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.syntheticPopulationReplay);
      return c.json({
        scope: 'recorded-decision-policy' as const,
        decisions: replaySyntheticPopulationDecisions(
          await repo().events(c.req.valid('param').id)
        ),
      });
    })
    .route('/', createSyntheticPopulationCommandRoutes(deps));
}

function createSyntheticPopulationCommandRoutes(
  deps: SyntheticPopulationRouteDeps
) {
  const admin = () =>
    new SyntheticPopulationAdministration(deps.getDb(), deps.ports);
  return new Hono()
    .put(
      '/config',
      zValidator('json', syntheticPopulationConfigSchema),
      async (c) => {
        const actorId = await deps.authorize(
          c.req.raw,
          PERMISSION.syntheticPopulationConfigure
        );
        const config = await admin().configure(c.req.valid('json'), actorId);
        return config === null
          ? c.json(
              { error: 'Configuration changed. Refresh before saving.' },
              409
            )
          : c.json({ config });
      }
    )
    .post(
      '/users/:id/commands',
      zValidator('param', userParam),
      zValidator('json', syntheticPopulationCommandSchema),
      async (c) => {
        const value = c.req.valid('json');
        const actorId = await deps.authorize(
          c.req.raw,
          value.command === 'inspect'
            ? PERMISSION.syntheticPopulationInspect
            : PERMISSION.syntheticPopulationControl
        );
        const accepted = await admin().command(
          c.req.valid('param').id,
          value,
          actorId
        );
        return accepted
          ? c.json({ accepted: true as const })
          : c.json(
              {
                error: 'Synthetic User not found or command identifier reused',
              },
              409
            );
      }
    );
}

export type SyntheticPopulationRPC = ReturnType<
  typeof createSyntheticPopulationRoutes
>;
