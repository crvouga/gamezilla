/**
 * Product `api` resource implement — real {@link createSimApiApp} from graph deps.
 */

import { api } from '@libs/runtime/shared/system';
import type { Io } from '@pkgs/io';
import type { ResourceCtx } from '@pkgs/system';
import { serveFetch } from '@pkgs/system';

import { createSimApiApp } from '../app/create-sim-api-app';
import {
  SIM_API_URL,
  SIM_BETTER_AUTH_SECRET,
  SIM_SQLITE_DATABASE_URL,
} from './migrate-sim-sqlite';
import { requireSimOpenRequestDb } from './sim-open-request-db';

function ioFromCtx(ctx: ResourceCtx): Io {
  return {
    clock: ctx.clock,
    timers: ctx.timers,
    createId: ctx.createId,
    random: ctx.random,
    http: {
      fetch: () => {
        throw new Error('sim api Io.http is unused — in-process Hono only');
      },
    },
    seed: ctx.seed,
  };
}

export const apiResource = api.implement(async (deps, ctx) => {
  const app = await createSimApiApp({
    io: ioFromCtx(ctx),
    openRequestDb: requireSimOpenRequestDb(deps.db),
    sqlClient: deps.db,
    pubSub: deps.events,
    objectStore: deps.media,
    stripe: deps.payments,
    llmProvider: deps.llm,
    ttsProvider: deps.tts,
    betterAuthSecret: SIM_BETTER_AUTH_SECRET,
    databaseUrl: process.env['SIM_API_DATABASE_URL'] ?? SIM_SQLITE_DATABASE_URL,
    apiUrl: SIM_API_URL,
  });
  return serveFetch((request) => app.fetch(request));
});
