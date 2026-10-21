import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/game-session-shared/custom-game-choice';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { readCustomGameProbe } from './custom-game-probe';
import { harnessGameAt, knownSetupAt } from './harness-game-of';
import { keepsOwnPrivateSetup } from './own-private-setups';

export async function customGameReference(s: ProductHarness, actor: string) {
  const probe = await readCustomGameProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no Custom Game screen`);
  return {
    gameId: probe.current?.id ?? null,
    revision: probe.current?.revision ?? 0,
  };
}

/** How long a choice in a game played only online waits for the space to sync. */
const SYNC_WAIT_MS = 2000;

/**
 * A choice in a custom game with private setups is made only online: give a
 * device that has just opened the space the moment it takes to sync. A device
 * that really is offline is still refused, as a person would be.
 */
async function awaitOnlineSpace(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const probe = await readCustomGameProbe(s, actor);
  if (probe?.current == null || probe.connected) return;
  if (
    harnessGameAt(s, probe.current.fen).shared.turnGame.rules.setup ===
    undefined
  )
    return;
  for (let waited = 0; waited < SYNC_WAIT_MS; waited += 100) {
    await s.session.advanceTime(100);
    await s.harness.drainServerFetch();
    if ((await readCustomGameProbe(s, actor))?.connected === true) return;
  }
}

/** A modified device uses the same online-only, acknowledged client operation. */
export async function sendCustomGameChoice(
  s: ProductHarness,
  actor: string,
  choice: CustomGameChoice
): Promise<string> {
  await awaitOnlineSpace(s, actor);
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const raw = JSON.stringify(choice);
  await ui.get('custom-game-command-input').clear();
  await ui.get('custom-game-command-input').input(raw);
  // regression: native-conformance-command-not-clickable
  await ui.get('custom-game-command-send').key('enter');
  for (let turn = 0; turn < 1_000; turn += 1) {
    const probe = await readCustomGameProbe(s, actor);
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
  input: CustomGameInput
): Promise<CustomGameInput> {
  if (input.operation !== 'ready' || input.setup !== undefined) return input;
  const probe = await readCustomGameProbe(s, actor);
  if (probe?.current == null || probe.mySide === null) return input;
  const setup = keepsOwnPrivateSetup(s, actor)
    ? probe.privateSetup?.arranged || undefined
    : knownSetupAt(s, probe.current.fen, probe.mySide);
  return setup === undefined ? input : { ...input, setup };
}

export async function chooseCustomGame(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<string> {
  return sendCustomGameChoice(s, actor, {
    ...(await withKnownSetup(s, actor, input)),
    ...(await customGameReference(s, actor)),
  });
}

/** Facts are acquired with real choices; a refused precondition cannot pass. */
export async function configureCustomGame(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  const reason = await chooseCustomGame(s, actor, input);
  if (reason !== '')
    throw new Error(`could not establish ${input.operation}: ${reason}`);
}

export async function waitCustomGameSettled(
  s: ProductHarness,
  actor: string,
  before: number
): Promise<string> {
  for (let turn = 0; turn < 1_000; turn += 1) {
    const probe = await readCustomGameProbe(s, actor);
    if (probe !== null && probe.settled > before) return probe.error;
    // A move made with no connection waits for it, still unanswered.
    if (probe?.waiting === true) return '';
    await s.session.advanceTime(0);
    await s.harness.drainServerFetch();
  }
  throw new Error(`${actor}'s game operation never settled`);
}

/** Attempt one choice as `actor`; a refusal shows as the probe's error. */
export const attemptCustomGame = scenarioAction({
  name: 'attemptCustomGame',
  act: async (s, actor: string, input: CustomGameInput) => {
    await chooseCustomGame(s, actor, input);
  },
});

/** A choice the scenario relies on; a refusal fails the precondition. */
export const configureCustomGameChoice = scenarioAction({
  name: 'configureCustomGameChoice',
  act: configureCustomGame,
});

/**
 * Send one exact choice (its own game and revision) as a modified device
 * could; becoming ready, it carries the actor side's known private setup
 * as {@link withKnownSetup} gives it, the setup a person readies with.
 */
export const attemptCustomGameChoice = scenarioAction({
  name: 'attemptCustomGameChoice',
  act: async (s, actor: string, choice: CustomGameChoice) => {
    const { gameId, revision } = choice;
    await sendCustomGameChoice(s, actor, {
      ...(await withKnownSetup(s, actor, choice)),
      gameId,
      revision,
    });
  },
});
