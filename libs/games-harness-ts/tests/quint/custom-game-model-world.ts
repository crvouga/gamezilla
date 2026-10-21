/**
 * The custom game the play, control and local models follow, of the trace's
 * game: its space, its participants, its moves along the first side's known
 * victory and what each person sees of it.
 */

import { attemptCustomGameBoundary } from '@libs/game-session-harness-ts/custom-game-boundary';
import { operateCustomGame } from '@libs/game-session-harness-ts/custom-game-controls';
import type { CustomGameSeat } from '@libs/game-session-harness-ts/custom-game-lineup';
import {
  establishCustomGame,
  joinCustomGames,
} from '@libs/game-session-harness-ts/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import { readCustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import {
  attemptCustomGame,
  attemptCustomGameChoice,
} from '@libs/game-session-harness-ts/custom-game-ui';
import { openCustomGames } from '@libs/game-session-harness-ts/game-navigation';
import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/game-session-shared-ts/custom-game-choice';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import {
  modelGameOf,
  modelResult,
  refusedMoveOf,
  VICTORY_MOVES,
  victoryMoveAt,
} from './model-game';

export const CUSTOM_MODEL_PEOPLE = ['alice', 'bob'] as const;
/** Someone in the space on neither side, whose view the models read. */
export const CUSTOM_MODEL_OBSERVER = 'charlie';

/** The people the trace put in the space, by name, with their identities. */
export function modelPeople(w: QuintHarnessWorld): Map<string, string> {
  const people = w.memo.get('model-people');
  if (people instanceof Map) return people as Map<string, string>;
  const created = new Map<string, string>();
  w.memo.set('model-people', created);
  return created;
}

/** The space's link, as the host shares it. */
export function modelSpaceLink(w: QuintHarnessWorld): string {
  return String(w.memo.get('custom-link'));
}

export function modelSpaceId(w: QuintHarnessWorld): string {
  return modelSpaceLink(w).split('/space/')[1] ?? '';
}

async function rememberPeople(
  w: QuintHarnessWorld,
  people: readonly string[]
): Promise<void> {
  for (const person of people) {
    const id = (await w.s.read(readCustomGameProbe, person))?.myId;
    if (!id) throw new Error(`${person} sees no custom games`);
    modelPeople(w).set(person, id);
  }
  const link = await w.s.read(readSpaceLink, people[0] ?? 'alice');
  if (link === null) throw new Error('The host has no space link');
  w.memo.set('custom-link', link);
}

/** `host`'s space at the game's custom games, with `others` in it, and no custom game yet. */
export async function openModelSpace(
  w: QuintHarnessWorld,
  host: string,
  others: readonly string[]
): Promise<void> {
  const gameId = modelGameOf(w).shared.id;
  await w.s.apply(signInWithGoogle, host);
  await w.s.apply(backToTabs, host);
  await w.s.apply(createSpace, host);
  await w.s.apply(openCustomGames, host, gameId);
  for (const other of others)
    await w.s.apply(joinCustomGames, gameId, host, other);
  await rememberPeople(w, [host, ...others]);
}

/**
 * Alice's custom game under way, of the trace's game: a person or a bot on
 * each side (Alice first, Bob second), untimed or one minute each with no
 * added seconds, and `watchers` and the observer in the space.
 */
export async function prepareCustomGameModel(
  w: QuintHarnessWorld,
  args: {
    readonly timed: boolean;
    readonly firstSideBot?: boolean;
    readonly secondSideBot?: boolean;
    readonly watchers?: readonly string[];
  }
): Promise<void> {
  const first: CustomGameSeat = args.firstSideBot ? 'bot' : 'alice';
  const second: CustomGameSeat = args.secondSideBot ? 'bot' : 'bob';
  const watchers = [
    ...(args.secondSideBot ? ['bob'] : []),
    ...(args.watchers ?? []),
    CUSTOM_MODEL_OBSERVER,
  ];
  await w.s.apply(establishCustomGame, modelGameOf(w).shared.id, {
    host: 'alice',
    first,
    second,
    watchers,
    ...(args.timed ? { clock: { minutes: 1, increment: 0 } } : {}),
  });
  await rememberPeople(w, ['alice', 'bob', ...watchers]);
}

export async function customModelGame(w: QuintHarnessWorld, actor = 'alice') {
  const game = (await w.quiet.read(readCustomGameProbe, actor))?.current;
  if (game === null || game === undefined)
    throw new Error(`${actor} sees no custom game`);
  return game;
}

/** A screen that shows no custom game refuses a modified device's choice too. */
export async function changeCustomModelChoice(
  w: QuintHarnessWorld,
  actor: string,
  input: CustomGameInput
): Promise<void> {
  if ((await w.s.read(readCustomGameProbe, actor)) !== null) {
    await w.s.apply(operateCustomGame, actor, input);
    return;
  }
  const game = await customModelGame(w);
  await w.s.apply(attemptCustomGameBoundary, actor, {
    spaceId: modelSpaceId(w),
    choice: { ...input, gameId: game.id, revision: game.revision },
  });
}

/**
 * `actor` makes the victory's next move as a person does, remembered when it
 * is played so that hearing it again can be tried; past the victory, its
 * first move, which a finished custom game refuses.
 */
export async function playCustomModelMove(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  const game = await customModelGame(w, actor);
  const played = game.moves.length;
  const uci = victoryMoveAt(w, played < VICTORY_MOVES ? played : 0);
  const choice: CustomGameChoice = {
    operation: 'move',
    uci,
    ply: played,
    gameId: game.id,
    revision: game.revision,
  };
  await w.s.apply(makeCustomGameMove, actor, modelGameOf(w).shared.id, uci);
  if ((await customModelGame(w, actor)).moves.length > played)
    w.memo.set('custom-model-last-move', { actor, choice });
}

/** `actor` makes a move the game refuses, sent as a modified device could. */
export async function refusedCustomModelMove(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  const game = await customModelGame(w, actor);
  await w.s.apply(attemptCustomGame, actor, {
    operation: 'move',
    uci: refusedMoveOf(w),
    ply: game.moves.length,
  });
}

/** The last acknowledged move heard again, or else a move the game refuses. */
export async function repeatCustomModelMove(
  w: QuintHarnessWorld
): Promise<void> {
  const last = w.memo.get('custom-model-last-move') as
    | { actor: string; choice: CustomGameChoice }
    | undefined;
  if (last !== undefined)
    await w.s.apply(attemptCustomGameChoice, last.actor, last.choice);
  else await refusedCustomModelMove(w, 'alice');
}

/** Each person's board: the custom game's state, moves and result, or `unavailable`. */
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
        : [game.status, game.moves.length, modelResult(game.outcome)]
    );
  }
  return shown;
}
