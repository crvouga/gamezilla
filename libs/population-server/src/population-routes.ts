import { zValidator } from '@hono/zod-validator';
import {
  type AppPermission,
  PERMISSION,
} from '@libs/permissions-shared/permission-catalog';
import {
  populationCommandSchema,
  populationConfigSchema,
} from '@libs/population-shared/config';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { replayPopulationDecisions } from './decision-replay';
import { PopulationAdministration } from './population-administration';
import { PopulationRepository } from './population-repository';
import type { PopulationPorts } from './records';

export type PopulationRouteDeps = {
  readonly getDb: () => SqlClient;
  readonly ports: PopulationPorts;
  readonly subscriptionCredentials: (
    actorId: string
  ) => Promise<{ username: string; password: string; expiresAt: number }>;
  readonly authorize: (
    request: Request,
    permission: AppPermission
  ) => Promise<string>;
};
const userParam = z.object({ id: z.string().uuid() });

export function createPopulationRoutes(deps: PopulationRouteDeps) {
  const admin = () => new PopulationAdministration(deps.getDb(), deps.ports);
  const repo = () => new PopulationRepository(deps.getDb(), deps.ports);
  return new Hono()
    .use('*', bodyLimit({ maxSize: 16_384 }))
    .get('/subscription', async (c) => {
      const actorId = await deps.authorize(
        c.req.raw,
        PERMISSION.populationView
      );
      return c.json(await deps.subscriptionCredentials(actorId));
    })
    .get('/', async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.populationView);
      const result = await admin().overview();
      // Live DOM is a separately authorized, on-demand read.
      return c.json({
        ...result,
        users: result.users.map(({ inspection: _inspection, ...user }) => user),
      });
    })
    .get('/users', async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.populationView);
      const users = await repo().users();
      return c.json({
        users: users.map(({ inspection: _inspection, ...user }) => user),
      });
    })
    .get('/workers', async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.populationView);
      return c.json({
        workers: await repo().workers(),
        observedAtMs: deps.ports.clock.now(),
      });
    })
    .get('/users/:id', zValidator('param', userParam), async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.populationInspect);
      const user = await repo().user(c.req.valid('param').id);
      return user === null
        ? c.json({ error: 'Synthetic User not found' }, 404)
        : c.json({ user });
    })
    .get('/users/:id/events', zValidator('param', userParam), async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.populationInspect);
      return c.json({ events: await repo().events(c.req.valid('param').id) });
    })
    .post('/users/:id/replay', zValidator('param', userParam), async (c) => {
      await deps.authorize(c.req.raw, PERMISSION.populationReplay);
      return c.json({
        scope: 'recorded-decision-policy' as const,
        decisions: replayPopulationDecisions(
          await repo().events(c.req.valid('param').id)
        ),
      });
    })
    .put('/config', zValidator('json', populationConfigSchema), async (c) => {
      const actorId = await deps.authorize(
        c.req.raw,
        PERMISSION.populationConfigure
      );
      const config = await admin().configure(c.req.valid('json'), actorId);
      return config === null
        ? c.json(
            { error: 'Configuration changed. Refresh before saving.' },
            409
          )
        : c.json({ config });
    })
    .post(
      '/users/:id/commands',
      zValidator('param', userParam),
      zValidator('json', populationCommandSchema),
      async (c) => {
        const value = c.req.valid('json');
        const actorId = await deps.authorize(
          c.req.raw,
          value.command === 'inspect'
            ? PERMISSION.populationInspect
            : PERMISSION.populationControl
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

export type PopulationRPC = ReturnType<typeof createPopulationRoutes>;
