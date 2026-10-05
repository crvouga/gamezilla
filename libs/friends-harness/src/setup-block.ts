import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
} from '@libs/auth-shared/auth-storage-keys';
import { deviceMutationEnv } from '@libs/auth-shared/device-mutation-env';
import { blockUserMutation } from '@libs/friends-shared/block-user-mutation';
import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import { accountIdOf } from '@libs/harness/identity';
import { awaitMutationVerdict } from '@pkgs/sync-engine-client/await-mutation-verdict';
import { createMutationClient } from '@pkgs/sync-engine-client/create-mutation-client';
import type { MutateResult } from '@pkgs/sync-engine-shared/mutations-types';

const VERDICT_MS = 5_000;

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
    const verdict = await pollUntil(
      s,
      async () => {
        if (failure !== undefined) throw failure;
        return result;
      },
      { maxMs: VERDICT_MS, description: `${blocker}'s block of ${blocked}` }
    );
    if (!verdict.ok)
      throw new Error(
        `${blocker} could not block ${blocked}: ${JSON.stringify(verdict.failures)}`
      );
  },
});
