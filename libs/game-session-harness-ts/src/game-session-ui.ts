import type {
  GameSessionChoice,
  GameSessionInput,
} from '@libs/game-session-shared-ts/game-session-choice';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront, partitioned } from '@libs/harness-ts/observations';
import { readGameSessionProbe } from './game-session-probe';
import { harnessGameAt, knownSetupAt } from './harness-game-of';
import { keepsOwnPrivateSetup } from './own-private-setups';
import { dealKnownHandsOnStart } from './room-draws';

export async function gameSessionReference(s: ProductHarness, actor: string) {
  const probe = await readGameSessionProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no Game Session screen`);
  return {
    gameId: probe.current?.id ?? null,
    revision: probe.current?.revision ?? 0,
  };
}

/** How long a choice in a game played only online waits for the space to sync. */
const SYNC_WAIT_MS = 2000;

/**
 * A choice in a game session with private setups is made only online: give a
 * device that has just opened the space the moment it takes to sync. A device
 * that really is offline is still refused, as a person would be.
 */
async function awaitOnlineSpace(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const probe = await readGameSessionProbe(s, actor);
  if (probe?.current == null || probe.connected) return;
  // A device cut off from the server is refused at once: waiting would only
  // spend time on the clocks of everyone still playing.
  if (partitioned(s).some((pair) => pair.split('|').includes(actor))) return;
  const game = harnessGameAt(s, probe.current.fen);
  if (
    game.shared.registration.rules.setup === undefined &&
    game.shared.turnGame?.rules.hands === undefined
  )
    return;
  for (let waited = 0; waited < SYNC_WAIT_MS; waited += 100) {
    await s.session.advanceTime(100);
    await s.harness.drainServerFetch();
    if ((await readGameSessionProbe(s, actor))?.connected === true) return;
  }
}

/** A modified device uses the same online-only, acknowledged client operation. */
export async function sendGameSessionChoice(
  s: ProductHarness,
  actor: string,
  choice: GameSessionChoice
): Promise<string> {
  await awaitOnlineSpace(s, actor);
  await dealKnownHandsOnStart(s, actor, choice.operation);
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const raw = JSON.stringify(choice);
  await ui.get('game-session-command-input').clear();
  await ui.get('game-session-command-input').input(raw);
  // regression: native-conformance-command-not-clickable
  await ui.get('game-session-command-send').key('enter');
  for (let turn = 0; turn < 1_000; turn += 1) {
    const probe = await readGameSessionProbe(s, actor);
    if (probe?.receipt.request === raw && !probe.receipt.pending)
      return probe.receipt.reason;
    // A move made with no connection waits for it, still unanswered.
    if (probe?.receipt.request === raw && probe.waiting) return '';
    await s.session.advanceTime(0);
    await s.harness.drainServerFetch();
  }
  throw new Error(
    `${actor}'s game choice was never confirmed at the same instant`
  );
}

/**
 * `input`, with the actor side's known private setup when they become ready
 * in a game that has one and the scenario names none: the setup a person
 * readies with is the game's own known one. A person arranging their own
 * (`keepOwnPrivateSetup`) readies with what their setup board holds, if
 * anything.
 */
export async function withKnownSetup(
  s: ProductHarness,
  actor: string,
  input: GameSessionInput
): Promise<GameSessionInput> {
  if (input.operation !== 'ready' || input.setup !== undefined) return input;
  const probe = await readGameSessionProbe(s, actor);
  if (probe?.current == null || probe.mySide === null) return input;
  const setup = keepsOwnPrivateSetup(s, actor)
    ? probe.privateSetup?.arranged || undefined
    : knownSetupAt(s, probe.current.fen, probe.mySide);
  return setup === undefined ? input : { ...input, setup };
}

export async function chooseGameSession(
  s: ProductHarness,
  actor: string,
  input: GameSessionInput
): Promise<string> {
  return sendGameSessionChoice(s, actor, {
    ...(await withKnownSetup(s, actor, input)),
    ...(await gameSessionReference(s, actor)),
  });
}

/** Facts are acquired with real choices; a refused precondition cannot pass. */
export async function configureGameSession(
  s: ProductHarness,
  actor: string,
  input: GameSessionInput
): Promise<void> {
  const reason = await chooseGameSession(s, actor, input);
  if (reason !== '')
    throw new Error(`could not establish ${input.operation}: ${reason}`);
}

export async function waitGameSessionSettled(
  s: ProductHarness,
  actor: string,
  before: number
): Promise<string> {
  for (let turn = 0; turn < 1_000; turn += 1) {
    const probe = await readGameSessionProbe(s, actor);
    if (probe !== null && probe.settled > before) return probe.error;
    // A move made with no connection waits for it, still unanswered.
    if (probe?.waiting === true) return '';
    await s.session.advanceTime(0);
    await s.harness.drainServerFetch();
  }
  throw new Error(`${actor}'s game operation never settled`);
}

/** Attempt one choice as `actor`; a refusal shows as the probe's error. */
export const attemptGameSession = scenarioAction({
  name: 'attemptGameSession',
  act: async (s, actor: string, input: GameSessionInput) => {
    await chooseGameSession(s, actor, input);
  },
});

/** A choice the scenario relies on; a refusal fails the precondition. */
export const configureGameSessionChoice = scenarioAction({
  name: 'configureGameSessionChoice',
  act: configureGameSession,
});

/**
 * Send one exact choice (its own game and revision) as a modified device
 * could; becoming ready, it carries the actor side's known private setup
 * as {@link withKnownSetup} gives it, the setup a person readies with.
 */
export const attemptGameSessionChoice = scenarioAction({
  name: 'attemptGameSessionChoice',
  act: async (s, actor: string, choice: GameSessionChoice) => {
    const { gameId, revision } = choice;
    await sendGameSessionChoice(s, actor, {
      ...(await withKnownSetup(s, actor, choice)),
      gameId,
      revision,
    });
  },
});
