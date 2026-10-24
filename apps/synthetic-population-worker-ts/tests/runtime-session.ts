import { ManagedSession } from '@apps/synthetic-population-worker-ts/managed-session';
import type { SessionInput } from '@apps/synthetic-population-worker-ts/session-messages';
import { reconcileCheckpoint } from '@libs/synthetic-population-shared-ts/config';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import {
  createIsolatedWorker,
  type IsolatedWorker,
} from '@pkgs/os-server-ts/wall-isolated-worker';
import type { runtimeBackend } from './runtime-backend';

type Backend = Awaited<ReturnType<typeof runtimeBackend>>;
export async function runtimeSession(
  backend: Backend,
  workerId: string,
  version = 'realm-test'
) {
  const response = await backend.rpc.claim.$post({ json: { workerId } });
  const { assignment: stored } = await response.json();
  if (stored === null)
    throw new Error('An application instance was not assigned');
  // regression: synthetic-native-pair-different-games
  // Fresh fixture peers choose chess with the same seeded policy;
  // production users retain independent policies, covered by game automation.
  const assignment = stored.registered
    ? stored
    : {
        ...stored,
        checkpoint: {
          ...reconcileCheckpoint(
            stored.checkpoint,
            backend.wall.clock.now(),
            'native-paired-chess-1'
          ),
          policySeed: 'native-paired-chess-1',
        },
      };
  const realm = createIsolatedWorker(
    new URL('../src/session-entry.ts', import.meta.url),
    ['@pkgs/bun-test-solid-client-ts/register'],
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
  let renewal: ReturnType<typeof backend.wall.timers.setInterval>;
  const stopRenewing = () => backend.wall.timers.clearInterval(renewal);
  // What the lease holder hands its realm from the user's internal inbox.
  const signInLinks: string[] = [];
  const thread: IsolatedWorker = {
    ...realm,
    post: (value) => {
      const message = value as SessionInput;
      if (message.type === 'sign-in-link' && message.link !== null)
        signInLinks.push(message.link);
      realm.post(value);
    },
  };
  const session = new ManagedSession(assignment, version, {
    ...backend.wall,
    rpc: backend.rpc,
    thread,
    log: createNoopLogger(),
    onClose: stopRenewing,
  });
  // Native fixtures renew leases just as the real Worker does, including auth.
  let renewing = false;
  renewal = backend.wall.timers.setInterval(() => {
    if (renewing) return;
    renewing = true;
    void session
      .renew(false)
      .catch(() => session.abort())
      .finally(() => {
        renewing = false;
      });
  }, 5_000);
  session.start(backend.origin);
  return {
    session,
    authenticated,
    assignment,
    realm,
    stopRenewing,
    signInLinks,
  };
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
    `The application instances did not reach the expected state: ${JSON.stringify(users.map((user) => ({ activity: user.activity, error: user.last_error, action: user.last_action })))}; matchmaking: ${JSON.stringify(await backend.matchmakingDiagnostics())}`
  );
}
