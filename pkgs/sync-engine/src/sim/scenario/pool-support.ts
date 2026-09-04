/**
 * Shared plumbing for the explore pool (`sync-actions.ts`) and the `recoverAll`
 * pin: restoreNetwork the fabric, remake clients that owe a restart, and tolerate the
 * faults chaos actions deliberately race into.
 */

import { isStorageFullError } from '../../client/storage-full-error';
import { peerClientIdsSharingRawDb } from '../sim-lifecycle';
import type { SyncSimBase } from './sim-types';
import type { SyncSim } from './system';

/**
 * Clients that must be remade before convergence is expected: crashed,
 * auth-revoked (fresh db), tampered, or protocol-cut. Pool actions record
 * here; `connect` / `restart` pool actions and `recoverAll` consume it.
 */
export function oweRestart(
  s: SyncSim,
  clientId: string,
  opts: { readonly fresh?: boolean } = {}
): void {
  s.runtime.owed.restart.add(clientId);
  if (opts.fresh === true) s.runtime.owed.fresh.add(clientId);
}

export function forgetOwedRestart(s: SyncSim, clientId: string): void {
  s.runtime.owed.restart.delete(clientId);
  s.runtime.owed.fresh.delete(clientId);
}

/** Revoking one client's auth wipes the raw db every peer engine shares. */
export function oweRevokedRestart(s: SyncSim, clientId: string): void {
  oweRestart(s, clientId, { fresh: true });
  for (const peerId of peerClientIdsSharingRawDb(s.clients, clientId)) {
    oweRestart(s, peerId, { fresh: true });
  }
}

/** Clear partitions / holds / faults so restart and sync can complete. */
export function restoreNetworkForIdle(surface: SyncSimBase): void {
  const network = surface.kit.network;
  network.releaseAll();
  network.restoreAllNetwork();
  network.clearNodeFaults();
}

export async function ensureServerUp(surface: SyncSimBase): Promise<void> {
  try {
    await surface.node('server').restart({ preserveLocalDb: true });
  } catch {
    // Server may already be running with HTTP bound.
  }
}

/** Injected sim faults that tear the client down mid-restart; restoreNetwork retries. */
export function isExpectedRestartFault(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('crash during epoch migrate') || msg === 'sim: fail next open'
  );
}

/** Remake a client; retry when failNextOpen / epoch-migrate arms fire. */
export async function restartClientWithRetry(
  surface: SyncSimBase,
  clientId: string,
  opts?: { readonly preserveLocalDb?: boolean }
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await surface.node(clientId).restart({
        preserveLocalDb: opts?.preserveLocalDb !== false,
      });
      return;
    } catch (error) {
      if (isExpectedRestartFault(error)) continue;
      throw error;
    }
  }
}

/**
 * Disarm boundary faults, bring the server up, restore auth, and remake one
 * client so it can take part in convergence.
 */
export async function restartClientForConverge(
  surface: SyncSimBase,
  clientId: string,
  opts?: { readonly preserveLocalDb?: boolean }
): Promise<void> {
  surface.clearEdgeFaults();
  await ensureServerUp(surface);
  surface.node(clientId).auth('valid');
  await restartClientWithRetry(surface, clientId, opts);
}

/** Pre-care for restart-shaped actions: nothing may tear the remake down. */
export async function prepareRestart(surface: SyncSimBase): Promise<void> {
  surface.clearEdgeFaults();
  restoreNetworkForIdle(surface);
  await ensureServerUp(surface);
}

/**
 * Full fabric restoreNetwork: drop pool subscriptions, clear storage arms, open every
 * link, and bring broker + server back.
 */
export async function restoreAllNetwork(s: SyncSim): Promise<void> {
  for (const sub of s.runtime.poolSubscriptions) sub[Symbol.dispose]();
  s.runtime.poolSubscriptions.clear();
  s.clearStoragePressure();
  s.clearFailNextOpen();
  for (const id of s.clients.keys()) s.net(id, 'all').set('ok');
  await s.brokerRestart();
  await ensureServerUp(s);
}

/** Skew arms are fire-and-forget — zero before settle. */
export function resetClockSkews(surface: SyncSimBase): void {
  surface.node('server').skewClock(0);
  for (const id of surface.clients.keys()) {
    surface.node(id).skewClock(0);
  }
}

function isKnownClient(s: SyncSim, id: string): boolean {
  return s.clients.has(id) || s.runtime.kernel.metas.has(id);
}

/** `upgrade_required` / expired: restore so queued mutations can drain. */
function restoreSettleAuth(s: SyncSim, skip: ReadonlySet<string>): void {
  for (const id of s.clients.keys()) {
    if (skip.has(id)) continue;
    s.node(id).auth('valid');
  }
}

/** Revoked / crashed / protocol-cut clients — restore auth, restart, restoreNetwork. */
export async function prepareClientsForInSync(s: SyncSim): Promise<void> {
  const owed = s.runtime.owed;
  const ids = [...owed.restart].filter((id) => isKnownClient(s, id));
  // Unfired armCrashAt (e.g. onNextEngineOpenAfterCacheWipe) must not hit
  // revoke / fresh-db migrate during restoreNetwork — chaos ends before converge prep.
  s.clearEdgeFaults();
  restoreSettleAuth(s, owed.fresh);
  if (ids.length === 0) {
    owed.restart.clear();
    owed.fresh.clear();
    return;
  }
  // Remake revoked / crashed clients before restoreNetwork so a shared-db peer is not
  // wiped by revokeDatabase while restoreNetwork nudges pending uploads.
  for (const id of ids) {
    await restartClientForConverge(s, id, {
      preserveLocalDb: !owed.fresh.has(id),
    });
  }
  owed.restart.clear();
  owed.fresh.clear();
  if (s.clients.size > 0) await s.advance(50);
  await restoreAllNetwork(s);
  restoreNetworkForIdle(s);
  resetClockSkews(s);
}

/** Chaos actions race domain constraints and armed faults; restoreNetwork later. */
export function isToleratedPoolError(error: unknown): boolean {
  if (isStorageFullError(error)) return true;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('UNIQUE constraint') ||
    msg.includes('unique constraint') ||
    msg.includes('SQLITE_CONSTRAINT') ||
    msg.includes('sim: crash') ||
    msg.includes('sim: fail next open')
  );
}
