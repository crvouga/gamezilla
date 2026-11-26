import { afterEach, expect, test } from 'bun:test';
import { AdminApp, loadAdminData } from '@apps/admin-client-ts/admin-app';
import { createAppSyncEnginePool } from '@libs/app-env-client-ts/sync-engine-pool';
import { AUTH_BEARER_STORAGE_KEY } from '@libs/app-root-shared-ts/auth-client-storage';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { createHarness } from '@libs/harness-ts/create-harness';
import { composeHarnessSlices } from '@libs/harness-ts/slices';
import { setDomWindow } from '@pkgs/bun-test-solid-client-ts/register';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
let stop: (() => Promise<void>) | undefined;

async function openAdmin(
  path: string,
  status: number | null,
  storage: 'available' | 'failed' = 'available'
) {
  const session = await virtualTimeRuntime().open(13);
  const harness = await createHarness(session, {
    composition: composeHarnessSlices('admin-client', []),
  });
  const client = await harness.client('alice');
  const calls: string[] = [];
  let decision = status;
  if (status !== null) {
    for (const [key, value] of [
      [AUTH_BEARER_STORAGE_KEY, 'session-a'],
      [SESSION_TOKEN_KEY, 'session-a'],
      [LAST_LOCAL_ACCOUNT_ID_KEY, ACCOUNT],
    ] as const)
      await client.secureStorage.write(key, value);
  }
  const env = {
    ...client,
    server: async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : input,
        client.serverUrl
      );
      calls.push(url.pathname);
      if (url.pathname === '/api/auth/providers')
        return Response.json({ providers: ['google'] });
      if (url.pathname === '/api/auth/session')
        return Response.json({
          user: { id: 'external-a', email: null, name: null },
        });
      if (url.pathname === '/api/identity/refresh')
        return Response.json({ accountId: ACCOUNT });
      if (url.pathname === '/api/identity/anon/ensure')
        return Response.json({ userId: ACCOUNT });
      if (url.pathname === '/api/admin/access') {
        if (
          new Headers(init?.headers).get('Authorization') !== 'Bearer session-a'
        )
          return new Response(null, { status: 403 });
        return new Response(null, { status: decision ?? 401 });
      }
      return Response.json({}, { status: 404 });
    },
  };
  const pool = createAppSyncEnginePool({
    loadMutations: async () => (await loadAdminData()).mutations(),
  });
  setDomWindow({
    width: 400,
    height: 800,
    url: `http://localhost:3000${path}`,
  });
  const sessionPool =
    storage === 'available'
      ? pool
      : {
          ...pool,
          getOrCreate: () => Promise.reject(new Error('Storage unavailable')),
        };
  const view = render(() => <AdminApp env={env} pool={sessionPool} />);
  stop = async () => {
    view.unmount();
    await pool.releaseAll();
    await harness.dispose();
    await session.dispose();
  };
  return {
    calls,
    setStatus: (next: number) => {
      decision = next;
    },
    changeAccount: () =>
      client.secureStorage.write(SESSION_TOKEN_KEY, 'session-b'),
  };
}

afterEach(async () => {
  await stop?.();
  stop = undefined;
});
const dashboard = () =>
  document.querySelector('[data-screen="admin-dashboard"]');
test('a signed-out deep link offers login without opening admin data', async () => {
  const app = await openAdmin('/admin/observatory/online', null);
  expect(await screen.findByText('Sign in to Administration')).toBeVisible();
  fireEvent.click(screen.getByText('Sign in'));
  expect(await screen.findByText(/Sign in with Google/)).toBeVisible();
  expect(app.calls).not.toContain('/api/query');
  expect(app.calls).not.toContain('/api/admin/observatory/live');
});
test('a denied deep link checks access again and keeps data closed on failure', async () => {
  const app = await openAdmin('/puzzles', 403);
  expect(
    await screen.findByText('Administrator access required')
  ).toBeVisible();
  app.setStatus(503);
  fireEvent.click(screen.getByText('Check again'));
  expect(await screen.findByText('Access could not be checked')).toBeVisible();
  expect(app.calls).not.toContain('/api/query');
});
test('the allowed account opens the dashboard and switching credentials closes it', async () => {
  const app = await openAdmin('/', 204);
  await waitFor(() => expect(dashboard()).not.toBeNull());
  await app.changeAccount();
  expect(
    await screen.findByText('Administrator access required')
  ).toBeVisible();
  expect(dashboard()).toBeNull();
});

test('an authorized deep link reports a storage failure and offers recovery without showing controls', async () => {
  const app = await openAdmin('/admin/observatory/online', 204, 'failed');
  expect(
    await screen.findByText('Could not open administration data')
  ).toBeVisible();
  expect(screen.getByText('Reload')).toBeVisible();
  expect(dashboard()).toBeNull();
  expect(app.calls).not.toContain('/api/admin/observatory/live');
});
test('an expired session must sign in again before private data opens', async () => {
  const app = await openAdmin('/', 401);
  expect(await screen.findByText('Sign in to Administration')).toBeVisible();
  expect(app.calls).toContain('/api/admin/access');
  expect(app.calls).not.toContain('/api/query');
});
