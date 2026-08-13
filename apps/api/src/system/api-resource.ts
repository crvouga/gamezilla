/**
 * Product `api` resource implement — real {@link createSimApiApp}, not a toy router.
 */

import { api } from '@libs/runtime/shared/system';
import type { Timers } from '@pkgs/clock';
import type { Io } from '@pkgs/io';
import {
  createInMemoryBus,
  type InMemoryBus,
} from '@pkgs/pubsub/testing/in-memory';
import { serveFetch } from '@pkgs/system';

import { createSimApiApp } from '../app/create-sim-api-app';
import { lookupSimSqlClient } from './sim-sql-registry';

const SIM_BETTER_AUTH_SECRET = 'sim-better-auth-secret-0123456789abcdef';
const SIM_API_URL = 'http://sim.local';
const SIM_SQLITE_DATABASE_URL = 'sqlite://sim';

const busByAddress = new Map<string, InMemoryBus>();
let simTimers: Timers | null = null;

/** Share one in-memory bus across API publish-only + client duplex peers. */
export function bindSimPubSubBus(address: string, bus: InMemoryBus): void {
  busByAddress.set(address, bus);
}

export function lookupSimPubSubBus(address = 'events'): InMemoryBus {
  const hit = busByAddress.get(address);
  if (hit) return hit;
  const bus = createInMemoryBus();
  busByAddress.set(address, bus);
  return bus;
}

/** Register real timers for sim API Io (from `@test/ui` / DST boot). */
export function registerSimApiTimers(timers: Timers): void {
  simTimers = timers;
}

function ioFromCtx(ctx: {
  clock: { now(): number };
  random: () => number;
}): Io {
  if (!simTimers) {
    throw new Error(
      'api.implement: call registerSimApiTimers before spawning api'
    );
  }
  let idSeq = 0;
  return {
    clock: ctx.clock,
    timers: simTimers,
    createId: () => {
      idSeq += 1;
      return `00000000-0000-4000-8000-${String(idSeq).padStart(12, '0')}`;
    },
    random: ctx.random,
    http: {
      fetch: () => {
        throw new Error('sim api Io.http is unused — in-process Hono only');
      },
    },
    seed: 1n,
  };
}

export const apiResource = api.implement(async (deps, ctx) => {
  void deps;
  const simDb = lookupSimSqlClient('db');
  const bus = lookupSimPubSubBus('events');
  const app = await createSimApiApp({
    io: ioFromCtx(ctx),
    openRequestDb: simDb.openRequestDb,
    pubSubBus: bus,
    betterAuthSecret: SIM_BETTER_AUTH_SECRET,
    databaseUrl: SIM_SQLITE_DATABASE_URL,
    apiUrl: SIM_API_URL,
  });
  return serveFetch((request) => app.fetch(request));
});
