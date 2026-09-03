import { defineSurface } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';

import type { SimSessionQuery } from '../domain-pack';
import { applyActionToShadow } from './action-shadow';
import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import {
  defaultClientIds,
  LIBRARY_ARB_ENTRIES,
  libraryActionArb,
} from './library-arbs';
import { replayStep } from './play';
import { clientIds, healWeight, partitioned } from './sync-observations';
import type { SyncSurface } from './system';

const { defineAction } = defineSurface<SyncSurface>();

async function applySyncAction(
  surface: SyncSurface,
  action: SyncAction
): Promise<void> {
  try {
    await replayStep({
      surface: surface,
      app: surface.runtime.app,
      action,
      state: surface.runtime.replay,
    });
    applyActionToShadow(surface.runtime.app, surface.shadow, action);
  } catch (error) {
    // Chaos actions race with domain constraints; heal+converge later.
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('UNIQUE constraint') ||
      msg.includes('unique constraint') ||
      msg.includes('SQLITE_CONSTRAINT') ||
      msg.includes('sim: crash') ||
      msg.includes('sim: fail next open')
    ) {
      return;
    }
    throw error;
  }
}

function libraryActions(sessionQuery: SimSessionQuery) {
  return LIBRARY_ARB_ENTRIES.map((entry) =>
    defineAction({
      name: entry.kind,
      enabled: (s) => {
        if (clientIds(s).length === 0) return false;
        if (entry.kind === 'heal') return healWeight(s) > 0;
        return true;
      },
      weight: (s) => {
        if (entry.kind === 'heal') return Math.max(partitioned(s).length, 1);
        return 1;
      },
      args: (s) =>
        gen(
          libraryActionArb(entry, {
            clientIds: clientIds(s),
            sessionQuery,
          }).map((action) => [action] as const)
        ),
      act: (s, action: SyncAction) => applySyncAction(s, action),
    })
  );
}

function domainAction(app: SyncApp) {
  return defineAction({
    name: 'domain',
    enabled: (s) => {
      const ids = clientIds(s);
      if (ids.length === 0) return false;
      return app.domainOpArbs({ clientIds: defaultClientIds(ids) }).length > 0;
    },
    args: (s) => {
      const arbs = app.domainOpArbs({
        clientIds: defaultClientIds(clientIds(s)),
      });
      return gen(fc.oneof(...arbs).map((action) => [action] as const));
    },
    act: (s, action: SyncAction) => applySyncAction(s, action),
  });
}

function serverAction(app: SyncApp) {
  if (app.serverOpArbs === undefined) return null;
  const serverOpArbs = app.serverOpArbs;
  return defineAction({
    name: 'server',
    enabled: (s) =>
      serverOpArbs({ clientIds: defaultClientIds(clientIds(s)) }).length > 0,
    args: (s) => {
      const arbs = serverOpArbs({
        clientIds: defaultClientIds(clientIds(s)),
      });
      return gen(fc.oneof(...arbs).map((action) => [action] as const));
    },
    act: (s, action: SyncAction) => applySyncAction(s, action),
  });
}

/** Build the action catalog for one sync app (library + domain + server). */
export function createSyncActions(app: SyncApp, sessionQuery: SimSessionQuery) {
  const server = serverAction(app);
  return [
    ...libraryActions(sessionQuery),
    domainAction(app),
    ...(server !== null ? [server] : []),
  ] as const;
}

export type SyncActions = ReturnType<typeof createSyncActions>;
