/** Shared helpers for the scripted-pin action modules. */

import { draw } from '@pkgs/dst';

import type { Mutation } from '../../mutations/core/types';
import type { SimClientHandle, SimSubscription } from '../client-handle';
import type { SyncSurface } from './system';

/** Virtual-time slice between scripted chaos steps. */
export const SYNC_STEP_MS = 10;

/** One scripted argument — `undefined` under random generation. */
export function pin<T>() {
  return draw<T | undefined>(() => undefined);
}

export function requireClient(
  s: SyncSurface,
  clientId: string
): SimClientHandle {
  const client = s.clients.get(clientId);
  if (client === undefined) {
    throw new Error(`sync pin: unknown client '${clientId}'`);
  }
  return client;
}

export function resolveMutation(
  s: SyncSurface,
  m: Mutation<unknown> | string
): Mutation<unknown> {
  if (typeof m !== 'string') return m;
  const registry =
    s.runtime.mutationRegistry ?? s.runtime.app.pack.mutationRegistry;
  const found = registry[m];
  if (found === undefined) {
    throw new Error(`sync pin: unknown mutation '${m}'`);
  }
  return found;
}

const DRIVE_STEP_MS = 25;
const DRIVE_BUDGET_MS = 2_000;
/** Bulk scope opens hydrate serially server-side; give them a wider window. */
export const SUBSCRIBE_ALL_BUDGET_MS = 30_000;

export async function driveToSettled(
  s: SyncSurface,
  label: string,
  op: () => Promise<unknown>,
  budgetMs = DRIVE_BUDGET_MS
): Promise<void> {
  let settled = false;
  const mark = () => {
    settled = true;
  };
  const started = op().then(mark, mark);
  for (let waited = 0; waited < budgetMs && !settled; waited += DRIVE_STEP_MS) {
    await s.advance(DRIVE_STEP_MS);
  }
  if (!settled) {
    throw new Error(
      `sync pin: '${label}' did not settle within ${String(budgetMs)}ms`
    );
  }
  await started;
}

/**
 * Like {@link driveToSettled} but tolerant: for fire-and-forget wakes that may
 * stay in flight (held sync, partition), advance virtual time up to the budget
 * and return whether the op finished.
 */
export async function driveWhilePending(
  s: SyncSurface,
  op: () => Promise<unknown>,
  budgetMs = DRIVE_BUDGET_MS
): Promise<boolean> {
  let settled = false;
  const mark = () => {
    settled = true;
  };
  void op().then(mark, mark);
  for (let waited = 0; waited < budgetMs && !settled; waited += DRIVE_STEP_MS) {
    await s.advance(DRIVE_STEP_MS);
  }
  return settled;
}

const subsBySurface = new WeakMap<object, Map<string, SimSubscription>>();

export function subscriptionKey(clientId: string, queryName: string): string {
  return `${clientId}:${queryName}`;
}

export function subscriptions(s: SyncSurface): Map<string, SimSubscription> {
  const existing = subsBySurface.get(s);
  if (existing !== undefined) return existing;
  const next = new Map<string, SimSubscription>();
  subsBySurface.set(s, next);
  return next;
}

export type PostRows = Parameters<SimClientHandle['postMutations']>[0];
