import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/game-session-shared/custom-game-choice';
import type { CustomGames } from '@libs/game-session-shared/custom-game-state';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';

export type CustomGameProbe = CustomGames & {
  readonly myId: string;
  readonly mySide: 'white' | 'black' | null;
  /** People in the space who are away, each with since when (room time). */
  readonly away: Readonly<Record<string, number>>;
  readonly error: string;
  readonly connected: boolean;
  readonly settled: number;
  readonly displayFen: string;
  readonly reviewPly: number;
  readonly live: boolean;
  readonly gates: Readonly<Record<string, boolean>>;
  readonly receipt: {
    readonly request: string;
    readonly reason: string;
    readonly pending: boolean;
  };
};

export async function readCustomGameProbe(
  s: ProductHarness,
  actor: string
): Promise<CustomGameProbe | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  try {
    const raw = await ui.get('custom-game-debug').text();
    return raw === null || raw.trim() === ''
      ? null
      : (JSON.parse(raw.replace(/\u200b/g, '')) as CustomGameProbe);
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'ElementNotFoundError')
      return null;
    throw cause;
  }
}

export async function customGameReference(s: ProductHarness, actor: string) {
  const probe = await readCustomGameProbe(s, actor);
  if (probe === null) throw new Error(`${actor} sees no Custom Game screen`);
  return {
    gameId: probe.current?.id ?? null,
    revision: probe.current?.revision ?? 0,
  };
}

/** A modified device uses the same online-only, acknowledged client operation. */
export async function sendCustomGameChoice(
  s: ProductHarness,
  actor: string,
  choice: CustomGameChoice
): Promise<string> {
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
    await s.session.advanceTime(0);
    await s.harness.drainServerFetch();
  }
  throw new Error(
    `${actor}'s game choice was never confirmed at the same instant`
  );
}

export async function chooseCustomGame(
  s: ProductHarness,
  actor: string,
  input: CustomGameInput
): Promise<string> {
  return sendCustomGameChoice(s, actor, {
    ...input,
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

/** Send one exact choice (its own game and revision) as a modified device could. */
export const attemptCustomGameChoice = scenarioAction({
  name: 'attemptCustomGameChoice',
  act: (s, actor: string, choice: CustomGameChoice) =>
    sendCustomGameChoice(s, actor, choice).then(() => undefined),
});
