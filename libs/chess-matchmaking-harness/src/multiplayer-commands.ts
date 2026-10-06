import { DEVICE_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { deviceMutationEnv } from '@libs/auth-shared/device-mutation-env';
import { MULTIPLAYER_MUTATIONS } from '@libs/chess-matchmaking-shared/multiplayer-mutations';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { actorHtml } from '@libs/harness/observations';
import { awaitMutationVerdict } from '@pkgs/sync-engine-client/await-mutation-verdict';
import { createMutationClient } from '@pkgs/sync-engine-client/create-mutation-client';
import type {
  MutateResult,
  Mutation,
} from '@pkgs/sync-engine-shared/mutations-types';
import { multiplayerClient } from './multiplayer-client';

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
    const mutation = MULTIPLAYER_MUTATIONS.find((m) => m.name === command.name);
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
    let result: MutateResult | null = null;
    let failure: unknown;
    void client.mutate(mutation as Mutation<unknown>, command.args).then(
      (value) => {
        result = value;
      },
      (error) => {
        failure = error;
      }
    );
    // Fine steps: a verdict arrives within milliseconds, and a coarser poll
    // would spend clock time a multiplayer game's deadlines count.
    await pollUntil(
      s,
      async () => {
        if (failure !== undefined) throw failure;
        return result;
      },
      { maxMs: 5000, stepMs: 1, description: 'the multiplayer command verdict' }
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

/** A UI gesture starts afresh: an earlier command's verdict no longer speaks for it. */
export function forgetMultiplayerReply(s: ProductHarness, actor: string): void {
  results.get(s)?.delete(actor);
}

/**
 * The refusal a person was last given on this device: the verdict of their
 * last command, or the reason on the denial the screen shows.
 */
export async function multiplayerRefusalCode(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const reply = multiplayerCommandReply(s, actor);
  if (reply !== null)
    return reply.result.ok ? null : (reply.result.failures[0]?.code ?? null);
  if (
    !(await (
      await actorUi(s, actor)
    )
      .get('multiplayer-command-denial')
      .isVisible())
  )
    return null;
  const html = (await actorHtml(s, actor)) ?? '';
  const tag = html.match(
    /<[^>]*data-testid="multiplayer-command-denial"[^>]*>/
  )?.[0];
  return tag?.match(/data-reason="([^"]+)"/)?.[1] ?? null;
}
