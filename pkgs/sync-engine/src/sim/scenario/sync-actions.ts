import { defineAction, draw } from '@pkgs/dst';
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
import { caps, clientIds, healWeight } from './sync-observations';
import type { SyncSurface } from './system';

async function applySyncAction(
  surface: SyncSurface,
  action: SyncAction
): Promise<void> {
  try {
    await replayStep({
      world: surface,
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
      *generate() {
        const ids = yield* clientIds;
        if (ids.length === 0) return;
        if (entry.kind === 'heal') {
          const w = yield* healWeight;
          if (w === 0) return;
        }
        const action = yield* draw(
          gen(
            libraryActionArb(entry, {
              clientIds: ids,
              sessionQuery,
            })
          )
        );
        yield {
          weight: 1,
          act: (s: SyncSurface) => applySyncAction(s, action),
        };
      },
    })
  );
}

function domainAction(app: SyncApp) {
  return defineAction({
    name: 'domain',
    *generate() {
      const ids = yield* clientIds;
      if (ids.length === 0) return;
      const arbs = app.domainOpArbs({ clientIds: defaultClientIds(ids) });
      if (arbs.length === 0) return;
      const action = yield* draw(gen(fc.oneof(...arbs)));
      yield {
        weight: 1,
        act: (s: SyncSurface) => applySyncAction(s, action),
      };
    },
  });
}

function serverAction(app: SyncApp) {
  if (app.serverOpArbs === undefined) return null;
  const serverOpArbs = app.serverOpArbs;
  return defineAction({
    name: 'server',
    *generate() {
      const ids = yield* clientIds;
      const arbs = serverOpArbs({ clientIds: defaultClientIds(ids) });
      if (arbs.length === 0) return;
      const action = yield* draw(gen(fc.oneof(...arbs)));
      yield {
        weight: 1,
        act: (s: SyncSurface) => applySyncAction(s, action),
      };
    },
  });
}

export const passTime = defineAction({
  name: 'passTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => 1 + Math.floor(rng.next() * 40));
    yield {
      weight: 1,
      act: (s: SyncSurface) => s.session.scheduler.advance(ms),
    };
  },
});

/** Build the action catalog for one sync app (library + domain + server). */
export function createSyncActions(app: SyncApp, sessionQuery: SimSessionQuery) {
  const server = serverAction(app);
  return [
    ...libraryActions(sessionQuery),
    domainAction(app),
    ...(server !== null ? [server] : []),
    passTime,
  ] as const;
}

export type SyncActions = ReturnType<typeof createSyncActions>;
