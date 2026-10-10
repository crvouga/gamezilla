import { ManagedSession } from '@apps/synthetic-population-worker/managed-session';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { createIsolatedWorker } from '@pkgs/os-server/wall-isolated-worker';
import type { runtimeBackend } from './runtime-backend';

type Backend = Awaited<ReturnType<typeof runtimeBackend>>;
export async function runtimeSession(
  backend: Backend,
  workerId: string,
  version = 'realm-test'
) {
  const response = await backend.rpc.claim.$post({ json: { workerId } });
  const { assignment } = await response.json();
  if (assignment === null)
    throw new Error('An application instance was not assigned');
  const realm = createIsolatedWorker(
    new URL('../src/session-entry.ts', import.meta.url),
    ['@pkgs/bun-test-solid-client/register'],
    { VITE_TEST_HOOKS: '0' }
  );
  const authenticated = new Promise<void>((resolve, reject) => {
    let lastError: string | null = null;
    realm.subscribe((value) => {
      const message = value as { type: string; error?: string | null };
      if (message.type === 'checkpoint' && message.error)
        lastError = message.error;
      if (message.type === 'authenticated') resolve();
      if (message.type === 'closed')
        reject(
          new Error(lastError ?? 'The application closed before authentication')
        );
    });
    realm.onError((error) => reject(new Error(error)));
  });
  const session = new ManagedSession(assignment, version, {
    ...backend.wall,
    rpc: backend.rpc,
    thread: realm,
    log: createNoopLogger(),
    onClose: () => undefined,
  });
  session.start(backend.origin);
  return { session, authenticated, assignment, realm };
}

export async function runtimeHeartbeat(
  backend: Backend,
  workerId: string,
  version: string
) {
  const response = await backend.rpc.heartbeat.$post({
    json: {
      workerId,
      version,
      capacity: 2,
      draining: false,
      memoryBytes: null,
      cpuMilliseconds: null,
      leaseFailures: 0,
    },
  });
  if (response.status !== 200) throw new Error('Worker heartbeat failed');
}

export async function awaitRuntimeUsers(
  backend: Backend,
  predicate: (
    users: Awaited<ReturnType<Backend['repository']['users']>>
  ) => boolean | Promise<boolean>,
  timeoutMs = 15_000
) {
  const deadline = backend.wall.clock.now() + timeoutMs;
  while (backend.wall.clock.now() < deadline) {
    const users = await backend.repository.users();
    if (await predicate(users)) return users;
    await new Promise<void>((resolve) =>
      backend.wall.timers.setTimeout(resolve, 10)
    );
  }
  const users = await backend.repository.users();
  throw new Error(
    `The application instances did not reach the expected state: ${JSON.stringify(users.map((user) => ({ activity: user.activity, error: user.last_error, action: user.last_action })))}`
  );
}
