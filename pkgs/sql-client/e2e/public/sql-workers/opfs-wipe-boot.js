// @io-wall-ok — same-origin OPFS wipe bootstrap (no expo-sqlite). Wall timers only.
/* global BroadcastChannel, SharedWorker */
const OPFS_WIPE_CHANNEL = 'gamezilla-opfs-wipe';
const SHARED_WORKER_URL = '/sql-workers/db-host-shared-worker.js';
const INITIATOR_KEY = 'sql-client-opfs-wipe-initiator';
const RETRY_MS = [0, 500, 1000, 2000, 3000, 5000, 8000];
const FORCE_RELEASE_WAIT_MS = 5000;
const POST_RELEASE_SETTLE_MS = 500;

function sanitizeReturn(returnRaw) {
  if (
    typeof returnRaw === 'string' &&
    returnRaw.startsWith('/') &&
    !returnRaw.startsWith('//') &&
    !returnRaw.includes('reset-opfs') &&
    !returnRaw.includes('opfs-wipe')
  ) {
    return returnRaw;
  }
  return '/';
}

function returnFromResetDbUrl() {
  const u = new URL(location.href);
  u.searchParams.delete('reset-db');
  u.searchParams.delete('opfs-wipe');
  u.searchParams.delete('parked');
  u.searchParams.delete('return');
  const ret =
    u.pathname +
    (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '') +
    u.hash;
  return sanitizeReturn(ret || '/');
}

function resolveReturnTo(params) {
  if (params.get('reset-db') === '1') {
    return returnFromResetDbUrl();
  }
  return sanitizeReturn(params.get('return') || '/');
}

function isParkedMode(params) {
  return params.get('parked') === '1' || params.get('opfs-wipe') === 'park';
}

function replaceWipeAddressBar(parked) {
  // Stay on the wipe document path (not SPA /). Preserve return= for navigateHome.
  try {
    const u = new URL(location.href);
    u.searchParams.set('opfs-wipe', parked ? 'park' : '1');
    u.searchParams.delete('opfs-wiping');
    u.searchParams.delete('parked');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch {
    // ignore
  }
}

function setStatus(text) {
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = text;
}

function fail(message) {
  setStatus('Could not reset local database.');
  const errorEl = document.getElementById('error');
  if (errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function broadcastWipeDone() {
  try {
    const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
    channel.postMessage({ type: 'wipe-done' });
    channel.close();
  } catch {
    // ignore
  }
}

function navigateHome(returnTo) {
  const target = returnTo || '/';
  // Cursor's embedded browser may no-op a bare origin replace; bust with `_wr`.
  const abs = new URL(target, location.origin);
  abs.searchParams.set('_wr', String(Date.now()));
  location.assign(abs.href);
}

function forceReleasePortDone(port, resolve) {
  let settled = false;
  return (ok) => {
    if (settled) return;
    settled = true;
    try {
      port.close();
    } catch {
      // ignore
    }
    resolve(ok);
  };
}

async function forceReleaseOwners() {
  if (typeof SharedWorker === 'undefined') return false;
  try {
    const worker = new SharedWorker(SHARED_WORKER_URL, {
      name: 'sql-db-host',
      type: 'module',
    });
    const port = worker.port;
    return await new Promise((resolve) => {
      const done = forceReleasePortDone(port, resolve);
      port.onmessage = (event) => {
        const data = event.data;
        if (data?.ok === true && data.id === 'force-release-all') {
          done(true);
        }
      };
      port.start();
      port.postMessage({
        id: 'force-release-all',
        type: 'force-release-all',
      });
      setTimeout(() => done(false), FORCE_RELEASE_WAIT_MS);
    });
  } catch {
    return false;
  }
}

function isNotFoundError(error) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

async function removeExpoSqliteChildren(dir) {
  for await (const entry of dir.values()) {
    try {
      await dir.removeEntry(entry.name, { recursive: true });
    } catch {
      // Child may still be locked; parent remove will report failure.
    }
  }
}

async function wipeOpfsOnce() {
  if (navigator.storage?.getDirectory === undefined) {
    return { ok: true, skipped: true };
  }
  const root = await navigator.storage.getDirectory();
  try {
    const dir = await root.getDirectoryHandle('expo-sqlite');
    await removeExpoSqliteChildren(dir);
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: true, skipped: true };
    }
  }
  try {
    await root.removeEntry('expo-sqlite', { recursive: true });
    return { ok: true, skipped: false };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { ok: true, skipped: true };
    }
    return { ok: false, error };
  }
}

async function prepareWipePeers() {
  if (typeof BroadcastChannel === 'undefined') return 0;
  const requestId = `wipe_${Date.now()}`;
  const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
  let ready = 0;
  channel.onmessage = (event) => {
    const data = event.data;
    if (
      data !== null &&
      typeof data === 'object' &&
      data.type === 'wipe-ready' &&
      data.requestId === requestId
    ) {
      ready += 1;
    }
  };
  channel.postMessage({ type: 'prepare-wipe', requestId });
  await sleep(3000);
  try {
    channel.close();
  } catch {
    // ignore
  }
  return ready;
}

async function wipeWithRetries() {
  let last = { ok: false, error: new Error('OPFS wipe did not run') };
  for (let i = 0; i < RETRY_MS.length; i++) {
    const wait = RETRY_MS[i] ?? 0;
    if (wait > 0) await sleep(wait);
    await forceReleaseOwners();
    await sleep(POST_RELEASE_SETTLE_MS);
    last = await wipeOpfsOnce();
    if (last.ok) return last;
  }
  return last;
}

function clearInitiatorFlag() {
  try {
    sessionStorage.removeItem(INITIATOR_KEY);
  } catch {
    // ignore
  }
}

async function runWipe(returnTo) {
  clearInitiatorFlag();
  setStatus('Asking other tabs to release local database…');
  await prepareWipePeers();
  setStatus('Clearing local database files…');
  const result = await wipeWithRetries();
  if (!result.ok) {
    const message =
      result.error instanceof Error
        ? result.error.message
        : String(result.error);
    fail(
      `${message}\n\nClose every other tab of this site, then reload and try Reset local data again.`
    );
    return;
  }
  setStatus('Done. Reloading…');
  // Navigate before broadcasting wipe-done so a stale app listener cannot
  // reload this wiping document and re-enter the bootstrap loop.
  navigateHome(returnTo);
  broadcastWipeDone();
}

function runPark(returnTo) {
  setStatus('Waiting for local database reset in another tab…');
  try {
    const channel = new BroadcastChannel(OPFS_WIPE_CHANNEL);
    channel.onmessage = (event) => {
      const data = event.data;
      if (
        data !== null &&
        typeof data === 'object' &&
        data.type === 'wipe-done'
      ) {
        try {
          channel.close();
        } catch {
          // ignore
        }
        navigateHome(returnTo);
      }
    };
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

(function bootOpfsWipe() {
  const params = new URLSearchParams(location.search);
  const parked = isParkedMode(params);
  const returnTo = resolveReturnTo(params);
  // Keep the wipe HTML path in the address bar (not SPA /). If we replaceState
  // to "/" here, navigateHome can no-op and never reload the app.
  replaceWipeAddressBar(parked);
  if (parked) {
    runPark(returnTo);
  } else {
    void runWipe(returnTo);
  }
})();
