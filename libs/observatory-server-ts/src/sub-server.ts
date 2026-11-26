import { defineSubServer } from '@libs/sub-shared-ts/server';
import { Hono } from 'hono';
import { createLiveReportRoutes } from './live-routes';
import type { SyntheticPopulationPortFactory } from './ports';
import { authContext, observatoryPorts } from './request-ports';

/** The app's own account and device; an unidentified request reports nothing. */
async function identifyLiveDevice(request: Request) {
  const auth = await authContext(request);
  const accountId = auth?.myId ?? '';
  const deviceId = auth?.deviceId ?? '';
  return accountId.length > 0 && deviceId.length > 0
    ? { accountId, deviceId }
    : null;
}

export function createLiveReportingServer(
  population: SyntheticPopulationPortFactory
) {
  return defineSubServer({
    name: 'live-reporting',
    routes: (ctx) =>
      new Hono().route(
        '/observatory-live',
        createLiveReportRoutes({
          getDb: ctx.getSqlClient,
          ports: observatoryPorts(ctx, population),
          identify: identifyLiveDevice,
        })
      ),
  });
}
