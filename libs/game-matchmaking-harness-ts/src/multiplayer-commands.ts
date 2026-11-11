import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { deviceMutationEnv } from '@libs/auth-shared-ts/device-mutation-env';
import { MULTIPLAYER_MUTATIONS } from '@libs/game-matchmaking-shared-ts/multiplayer-mutations';
import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorHtml } from '@libs/harness-ts/observations';
import type { DeviceMutations } from '@libs/harness-ts/webview-mutations';
import { awaitMutationVerdict } from '@pkgs/sync-engine-client-ts/await-mutation-verdict';
import { createMutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import type {
  MutateResult,
  Mutation,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { multiplayerClient } from './multiplayer-client';
import { multiplayerSpaceId } from './multiplayer-spaces';
import { holdOpponentPool } from './opponent-pool-hold';

export type MultiplayerCommand = {
  readonly name: string;
  readonly args: Record<string, unknown>;
};
const results = new WeakMap<
  ProductHarness,
  Map<string, { command: MultiplayerCommand; result: MutateResult }>
>();

type Verdict = () => Promise<MutateResult | null>;
type CommandArgs = () => Promise<Record<string, unknown>>;

/** The harness's own client for an in-process device, which it holds itself. */
async function sendInProcess(
  s: ProductHarness,
  actor: string,
  mutation: Mutation<unknown>,
  commandArgs: CommandArgs
): Promise<Verdict> {
  const { live, env, owner, engine } = await multiplayerClient(s, actor);
  const client = createMutationClient({
    db: engine.db,
    registry: await live.syncEnginePool.mutationRegistry(),
    env: {
      ...deviceMutationEnv(owner, env),
      turnGames: s.harness.composition.app.turnGames,
    },
    ids: { clientId: String(env.secureStorage.getValue(DEVICE_ID_KEY)) },
    createId: env.createId,
    connectivity: { isOnline: () => engine.status.getSnapshot().online },
    awaitVerdict: (id) => awaitMutationVerdict(engine, id),
    onQueued: ({ mutation: def, args, capture }) => {
      engine.wakeUploads();
      engine.notifyLocalMutation(def, args, capture);
    },
  });
  const args = await commandArgs();
  let result: MutateResult | null = null;
  let failure: unknown;
  void client.mutate(mutation, args).then(
    (value) => {
      result = value;
    },
    (error) => {
      failure = error;
    }
  );
  return async () => {
    if (failure !== undefined) throw failure;
    return result;
  };
}

/**
 * A live browser's own client: the page sends the command, as its screen
 * does. The in-process client the harness also holds is not this device: it
 * never opens the person's database, so it has no identity bound to send as.
 */
async function sendFromDevice(
  mutations: DeviceMutations,
  name: string,
  commandArgs: CommandArgs
): Promise<Verdict> {
  const ticket = await mutations.send(name, await commandArgs());
  return async () => {
    const verdict = await mutations.verdict(ticket);
    if (verdict === null) return null;
    if ('error' in verdict) throw new Error(verdict.error);
    return verdict.result;
  };
}

/** Same client mutation boundary as the UI, including offline and pending verdicts. */
export const sendMultiplayerCommand = scenarioAction({
  name: 'sendMultiplayerCommand',
  act: async (s, actor: string, command: MultiplayerCommand) => {
    await holdOpponentPool(s);
    await ensureActor(s, actor);
    const mutation = MULTIPLAYER_MUTATIONS.find((m) => m.name === command.name);
    if (mutation === undefined)
      throw new Error(`Unknown game command ${command.name}`);
    const commandArgs = async () => ({
      spaceId: (await multiplayerSpaceId(s, actor)) ?? 'no-space',
      ...command.args,
    });
    const device = s.actors.get(actor)?.mutations;
    const verdict =
      device === undefined
        ? await sendInProcess(
            s,
            actor,
            mutation as Mutation<unknown>,
            commandArgs
          )
        : await sendFromDevice(device, command.name, commandArgs);
    // Fine steps: a verdict arrives within milliseconds, and a coarser poll
    // would spend clock time a multiplayer game's deadlines count.
    const result = await pollUntil(s, verdict, {
      maxMs: 5000,
      stepMs: 1,
      description: 'the multiplayer command verdict',
    });
    let bag = results.get(s);
    if (bag === undefined) {
      bag = new Map();
      results.set(s, bag);
    }
    bag.set(actor, { command, result });
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
