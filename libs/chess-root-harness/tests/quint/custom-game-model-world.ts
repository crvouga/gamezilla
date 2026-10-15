import {
  attemptCustomGameChoice,
  changeCustomGame,
} from '@libs/chess-custom-game-harness/custom-game-actions';
import { attemptCustomGameBoundary } from '@libs/chess-custom-game-harness/custom-game-boundary';
import { CUSTOM_GAME_FOOLS_MATE } from '@libs/chess-custom-game-harness/custom-game-histories';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/game-session-shared/custom-game-choice';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  customFact,
  customSpace,
  customStart,
} from '../steps/custom-game-world';

export const CUSTOM_MODEL_PEOPLE = ['alice', 'bob'] as const;
export const CUSTOM_MODEL_OBSERVER = 'charlie';

export async function prepareCustomGameModel(
  w: QuintHarnessWorld,
  args: {
    timed: boolean;
    whiteBot?: boolean;
    blackBot?: boolean;
    watchers?: readonly string[];
  }
): Promise<void> {
  await customSpace(w, 'alice', [
    'bob',
    ...(args.watchers ?? []),
    CUSTOM_MODEL_OBSERVER,
  ]);
  await customFact(w, 'alice', { operation: 'create' });
  if (args.whiteBot)
    await customFact(w, 'alice', { operation: 'bot', side: 'white' });
  if (args.blackBot)
    await customFact(w, 'alice', { operation: 'bot', side: 'black' });
  else await customFact(w, 'bob', { operation: 'claim', side: 'black' });
  if (args.timed)
    await customFact(w, 'alice', {
      operation: 'clock',
      minutes: 1,
      increment: 0,
    });
  await customStart(w);
}

export async function customModelGame(w: QuintHarnessWorld, actor = 'alice') {
  const game = (await w.quiet.read(readCustomGameProbe, actor))?.current;
  if (game === null || game === undefined)
    throw new Error(`${actor} sees no Custom Game`);
  return game;
}

/** An unavailable screen also refuses a modified device's attempted choice. */
export async function changeCustomModelChoice(
  w: QuintHarnessWorld,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  if ((await w.s.read(readCustomGameProbe, actor)) !== null) {
    await w.s.apply(changeCustomGame, actor, input);
    return;
  }
  const game = await customModelGame(w);
  const spaceId = String(w.memo.get('custom-link')).slice('/space/'.length);
  await w.s.apply(attemptCustomGameBoundary, actor, {
    spaceId,
    choice: { ...input, gameId: game.id, revision: game.revision },
  });
}

export async function playCustomModelMove(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  const game = await customModelGame(w, actor);
  const uci = CUSTOM_GAME_FOOLS_MATE[game.moves.length] ?? 'f2f3';
  const input = { operation: 'move', uci, ply: game.moves.length } as const;
  const choice: CustomGameChoice = {
    ...input,
    gameId: game.id,
    revision: game.revision,
  };
  await w.s.apply(changeCustomGame, actor, input);
  if ((await customModelGame(w, actor)).moves.length > game.moves.length)
    w.memo.set('custom-model-last-move', { actor, choice });
}

export async function repeatCustomModelMove(
  w: QuintHarnessWorld
): Promise<void> {
  const last = w.memo.get('custom-model-last-move') as
    | { actor: string; choice: CustomGameChoice }
    | undefined;
  if (last !== undefined)
    await w.s.apply(attemptCustomGameChoice, last.actor, last.choice);
  else
    await w.s.apply(changeCustomGame, 'alice', {
      operation: 'move',
      uci: 'e2e5',
      ply: 0,
    });
}

export async function readCustomModelShown(
  w: QuintHarnessWorld,
  people: readonly string[] = CUSTOM_MODEL_PEOPLE
) {
  const shown = new Map<string, [string, number, string]>();
  for (const actor of people) {
    const game = (await w.quiet.read(readCustomGameProbe, actor))?.current;
    shown.set(
      actor,
      game === null || game === undefined
        ? ['unavailable', 0, '']
        : [game.status, game.moves.length, game.outcome]
    );
  }
  return shown;
}
