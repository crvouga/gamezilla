import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { deviceMutationEnv } from '@libs/auth-shared-ts/device-mutation-env';
import { blockUserMutation } from '@libs/friends-shared-ts/block-user-mutation';
import {
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import { runScopedCreateId } from '@libs/harness-ts/run-scope';
import type { DeviceMutations } from '@libs/harness-ts/webview-mutations';
import { awaitMutationVerdict } from '@pkgs/sync-engine-client-ts/await-mutation-verdict';
import { createMutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import type { MutateResult } from '@pkgs/sync-engine-shared-ts/mutations-types';

const VERDICT_MS = 5_000;

type ReadVerdict = () => Promise<MutateResult | null>;

async function sendBrowserBlock(
  device: DeviceMutations,
  args: { userId: string; blockId: string }
): Promise<ReadVerdict> {
  const ticket = await device.send(blockUserMutation.name, args);
  return async () => {
    const verdict = await device.verdict(ticket);
    if (verdict === null) return null;
    if ('error' in verdict) throw new Error(verdict.error);
    return verdict.result;
  };
}

async function sendInProcessBlock(
  s: ProductHarness,
  blocker: string,
  userId: string
): Promise<ReadVerdict> {
  const live = await s.harness.spawnClient(blocker);
  const env = live.env;
  const owner = env.secureStorage.getValue(LAST_LOCAL_ACCOUNT_ID_KEY);
  if (!owner) throw new Error(`${blocker} has no account to block from`);
  const engine = live.syncEnginePool.peekReady(
    env.resolveDatabaseName({ userId: owner })
  );
  if (engine === null) throw new Error(`${blocker}'s app is not ready`);
  const client = createMutationClient({
    db: engine.db,
    registry: await live.syncEnginePool.mutationRegistry(),
    env: deviceMutationEnv(owner, env),
    ids: { clientId: String(env.secureStorage.getValue(DEVICE_ID_KEY)) },
    createId: env.createId,
    connectivity: { isOnline: () => engine.status.getSnapshot().online },
    awaitVerdict: (id) => awaitMutationVerdict(engine, id),
    onQueued: ({ mutation, args, capture }) => {
      engine.wakeUploads();
      engine.notifyLocalMutation(mutation, args, capture);
    },
  });
  let result: MutateResult | null = null;
  let failure: unknown;
  client.mutate(blockUserMutation, { userId, blockId: env.createId() }).then(
    (value) => {
      result = value;
    },
    (error: unknown) => {
      failure = error;
    }
  );
  return async () => {
    if (failure !== undefined) throw failure;
    return result;
  };
}

/**
 * `blocker` blocks `blocked` through the same block mutation their app sends,
 * without walking there through search: a block as a fact a scenario starts
 * from, wherever the blocker happens to be in the app.
 */
export const setupBlock = scenarioAction({
  name: 'setupBlock',
  act: async (s, blocker: string, blocked: string) => {
    const userId = await accountIdOf(s, blocked);
    if (userId === null) throw new Error(`${blocked} has no account to block`);
    await ensureActor(s, blocker);
    const device = s.actors.get(blocker)?.mutations;
    const readVerdict = device
      ? await sendBrowserBlock(device, {
          userId,
          blockId: runScopedCreateId(s)(),
        })
      : await sendInProcessBlock(s, blocker, userId);
    const verdict = await pollUntil(s, readVerdict, {
      maxMs: VERDICT_MS,
      description: `${blocker}'s block of ${blocked}`,
    });
    if (!verdict.ok)
      throw new Error(
        `${blocker} could not block ${blocked}: ${JSON.stringify(verdict.failures)}`
      );
  },
});
