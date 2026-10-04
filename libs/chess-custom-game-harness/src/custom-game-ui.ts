import { actorUi } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';
import type { CustomGameChoice, CustomGameInput } from '@libs/chess-custom-game-shared/custom-game-choice';
import type { CustomGames } from '@libs/chess-custom-game-shared/custom-game-state';

export type CustomGameProbe = CustomGames & {
  readonly myId: string;
  readonly mySide: 'white' | 'black' | null;
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
    const raw = await ui.get('chess-custom-debug').text();
    return raw === null || raw.trim() === ''
      ? null
      : (JSON.parse(raw.replace(/\u200b/g, '')) as CustomGameProbe);
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'ElementNotFoundError')
      return null;
    throw cause;
  }
}

export async function openCustomGameScreen(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  if (await ui.get(Handles.gameMenuChess).isVisible())
    await ui.get(Handles.gameMenuChess).tap();
  if (await ui.get('chess-menu-custom-game').isVisible())
    await ui.get('chess-menu-custom-game').tap();
  await ui.get('chess-custom-status').expect.visible();
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
  await ui.get('chess-custom-command-input').clear();
  await ui.get('chess-custom-command-input').input(raw);
  await ui.get('chess-custom-command-send').tap();
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
