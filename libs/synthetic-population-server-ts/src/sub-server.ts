import { notifyUserChannels } from '@libs/app-root-server-ts/notify-user-channels';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import { defineSubServer, type SubServerCtx } from '@libs/sub-shared-ts/server';
import { Hono } from 'hono';
import { bindSyntheticPopulationAccount } from './account-binding';
import { notifySyntheticPopulation, readSecret } from './request-ports';
import {
  authorizeSyntheticPopulationMutation,
  authorizeSyntheticPopulationSession,
  syntheticPopulationRoomGrants,
} from './session-fencing';
import { createSyntheticPopulationWorkerRoutes } from './worker-routes';

function routes(ctx: SubServerCtx) {
  const ports = {
    clock: ctx.clock,
    createId: ctx.createId,
    notify: notifySyntheticPopulation,
  };
  const workers = createSyntheticPopulationWorkerRoutes({
    getDb: ctx.getSqlClient,
    ports,
    bindAccount: (lease, token) =>
      bindSyntheticPopulationAccount(
        {
          db: ctx.getSqlClient(),
          authServer: ctx.authServer,
          ports,
          notifyProfile: (accountId) =>
            notifyUserChannels(
              [accountId],
              'synthetic-population-account-classification',
              { tables: ['profile'] }
            ),
        },
        lease,
        token
      ),
    authorize: async (request) => {
      const expected = await readSecret('POPULATION_WORKER_TOKEN');
      const presented = request.headers.get('authorization')?.slice(7) ?? '';
      let different = presented.length ^ expected.length;
      for (let i = 0; i < expected.length; i += 1)
        different |= expected.charCodeAt(i) ^ (presented.charCodeAt(i) || 0);
      if (
        !request.headers.get('authorization')?.startsWith('Bearer ') ||
        different !== 0
      )
        throw new UnauthorizedError(
          'Synthetic Population Worker authentication required'
        );
    },
  });
  return new Hono().route('/synthetic-population-worker', workers);
}

export const SYNTHETIC_POPULATION_SERVER = defineSubServer({
  name: 'synthetic-population',
  routes,
  authorizeSession: authorizeSyntheticPopulationSession,
  authorizeMutation: authorizeSyntheticPopulationMutation,
  roomGrants: syntheticPopulationRoomGrants,
});
