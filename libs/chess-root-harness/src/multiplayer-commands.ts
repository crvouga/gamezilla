import { DEVICE_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { deviceMutationEnv } from '@libs/auth-shared/device-mutation-env';
import { CHESS_MUTATIONS } from '@libs/chess-feature-shared/mutations';
import { multiplayerClient } from '@libs/chess-matchmaking-harness/multiplayer-client';
import { multiplayerSpaceId } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { ensureActor, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { awaitMutationVerdict } from '@pkgs/sync-engine-client/await-mutation-verdict';
import { createMutationClient } from '@pkgs/sync-engine-client/create-mutation-client';
import type {
  MutateResult,
  Mutation,
} from '@pkgs/sync-engine-shared/mutations-types';

export type MultiplayerCommand = {
  readonly name: string;
  readonly args: Record<string, unknown>;
};
const results = new WeakMap<
  ProductHarness,
  Map<string, { command: MultiplayerCommand; result: MutateResult }>
>();

/** Same client mutation boundary as the UI, including offline and pending verdicts. */
export const sendMultiplayerCommand = scenarioAction({
  name: 'sendMultiplayerCommand',
  act: async (s, actor: string, command: MultiplayerCommand) => {
    await ensureActor(s, actor);
    const { live, env, owner, engine } = await multiplayerClient(s, actor);
    const mutation = CHESS_MUTATIONS.find((m) => m.name === command.name);
    if (mutation === undefined)
      throw new Error(`Unknown chess command ${command.name}`);
    const client = createMutationClient({
      db: engine.db,
      registry: await live.syncEnginePool.mutationRegistry(),
      env: deviceMutationEnv(owner, env),
      ids: { clientId: String(env.secureStorage.getValue(DEVICE_ID_KEY)) },
      createId: env.createId,
      connectivity: { isOnline: () => engine.status.getSnapshot().online },
      awaitVerdict: (id) => awaitMutationVerdict(engine, id),
      onQueued: ({ mutation: def, args, capture }) => {
        engine.wakeUploads();
        engine.notifyLocalMutation(def, args, capture);
      },
    });
    const args = {
      spaceId: (await multiplayerSpaceId(s, actor)) ?? 'no-space',
      ...command.args,
    };
    let result: MutateResult | null = null;
    let failure: unknown;
    void client.mutate(mutation as Mutation<unknown>, args).then(
      (value) => {
        result = value;
      },
      (error) => {
        failure = error;
      }
    );
    await pollUntil(
      s,
      async () => {
        if (failure !== undefined) throw failure;
        return result;
      },
      { maxMs: 5000, description: 'the multiplayer command verdict' }
    );
    let bag = results.get(s);
    if (bag === undefined) {
      bag = new Map();
      results.set(s, bag);
    }
    bag.set(actor, { command, result: result! });
  },
});

export function multiplayerCommandReply(s: ProductHarness, actor: string) {
  return results.get(s)?.get(actor) ?? null;
}
