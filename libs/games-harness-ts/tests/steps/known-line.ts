/**
 * Where a game's known lines go, read with the game's own rules as its
 * authority plays them (`playedRulesOf`): who is to move after a prefix,
 * where a round of secret choices opens, and each side's own secret choice
 * in it. Scenarios name positions in product words ("Bob to move", "the
 * second round of secret choices"); these find that position on a line the
 * game's author wrote, so every game reaches it its own way.
 */

import { playCustomGameHistory } from '@libs/game-session-harness-ts/custom-game-history';
import type { CustomGameLineup } from '@libs/game-session-harness-ts/custom-game-lineup';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  playedRulesOf,
  splitCommittedProposal,
  splitDealtPosition,
} from '@libs/game-session-harness-ts/played-rules';
import {
  partition,
  refreshActorConnection,
  restoreNetwork,
} from '@libs/harness-ts/actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import type {
  GameSide,
  GameWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  gameOf,
  hostOf,
  rememberCustomGame,
  setupCustomGame,
  spaceLinkOf,
} from './game-world';

const KNOWN_LINE = 'known-line';

/** Whether `proposal` is a whole round of secret choices. */
export function isSecretChoices(proposal: string | undefined): boolean {
  return proposal !== undefined && splitCommittedProposal(proposal) !== null;
}

/** What the rules make of a line's first `ply` proposals. */
export type LineState = {
  /** The side to move next. */
  readonly turn: GameSide;
  /** The side that made the last proposal, `null` at the start. */
  readonly lastMover: GameSide | null;
  readonly winner: GameWinner | null;
};

/** The state of `line` after its first `ply` proposals, by the game's rules. */
export function lineState(
  game: HarnessGame,
  line: readonly string[],
  ply = line.length
): LineState {
  const rules = playedRulesOf(game);
  let position = rules.initial();
  let history = '';
  let state: LineState = {
    turn: gameSides(game.shared.turnGame.rules)[0]!,
    lastMover: null,
    winner: null,
  };
  for (const [index, proposal] of line.slice(0, ply).entries()) {
    const played = rules.play(
      position,
      proposal,
      history,
      line.slice(0, index)
    );
    if (played === null)
      throw new Error(`${game.label}: ${proposal} is not a move here`);
    state = { turn: played.turn, lastMover: state.turn, winner: played.winner };
    position = played.position;
    history = played.history;
  }
  return state;
}

/** The shortest prefix of `line` after which `side` is to move with no round of secret choices open. */
export function plyWithMover(
  game: HarnessGame,
  line: readonly string[],
  side: GameSide
): number {
  for (let ply = 0; ply < line.length; ply += 1)
    if (!isSecretChoices(line[ply]) && lineState(game, line, ply).turn === side)
      return ply;
  throw new Error(`${game.label}: its known line never has ${side} to move`);
}

/** Where each round of secret choices of `line` opens, in order. */
export function secretChoiceRounds(line: readonly string[]): readonly number[] {
  return line.flatMap((proposal, ply) =>
    isSecretChoices(proposal) ? [ply] : []
  );
}

/** The `n`-th round of secret choices of `line` (1 for the first). */
export function secretChoiceRound(
  game: HarnessGame,
  line: readonly string[],
  n: number
): number {
  const ply = secretChoiceRounds(line)[n - 1];
  if (ply === undefined)
    throw new Error(
      `${game.label}: its known line has no round ${String(n)} of secret choices`
    );
  return ply;
}

/** A later round of secret choices of `line` that opens right after `side`'s move. */
export function roundAfterMoveBy(
  game: HarnessGame,
  line: readonly string[],
  side: GameSide
): number {
  const ply = secretChoiceRounds(line).find(
    (round) => round > 0 && lineState(game, line, round).lastMover === side
  );
  if (ply === undefined)
    throw new Error(
      `${game.label}: no round of secret choices on its known line opens after the ${side} side's move`
    );
  return ply;
}

/** The known line the custom game follows, its game's known victory unless a scenario chose another. */
export function knownLine(w: HarnessWorld): readonly string[] {
  return (
    (w.memo.get(KNOWN_LINE) as readonly string[] | undefined) ??
    gameOf(w).fixtures.firstSideVictory
  );
}

/**
 * The known line's next move after `ply` moves: `undefined` when the line
 * is not being followed, is over, or opens a round of secret choices.
 */
export function knownNextMove(
  w: HarnessWorld,
  ply: number
): string | undefined {
  const line = w.memo.get(KNOWN_LINE) as readonly string[] | undefined;
  const next = line?.[ply];
  return next === undefined || isSecretChoices(next) ? undefined : next;
}

/**
 * A custom game of `lineup` that has followed `line`'s first `ply`
 * proposals: played as an earlier history, then followed by the scenario.
 */
export async function followKnownLine(
  w: HarnessWorld,
  lineup: CustomGameLineup,
  line: readonly string[],
  ply: number
): Promise<void> {
  w.memo.set(KNOWN_LINE, line);
  await setupCustomGame(w, {
    ...lineup,
    ...(ply === 0 ? {} : { history: line.slice(0, ply) }),
  });
}

/**
 * The custom game under way at its start follows `line` to its last move:
 * the proposals before it are played as an earlier history through the
 * room under each seat's device, the devices cut off meanwhile and then
 * caught up, as a custom game set up with a history is.
 */
export async function playToLastMove(
  w: HarnessWorld,
  line: readonly string[]
): Promise<void> {
  w.memo.set(KNOWN_LINE, line);
  const host = hostOf(w);
  const game = (await w.s.read(customGameView, host)).current;
  if (game === null || game.moves.length !== 0)
    throw new Error('The custom game is not at its start');
  const seats = Object.fromEntries(
    await Promise.all(
      game.sides.map(async (side) => [
        side,
        await personOn(w, game[side].person),
      ])
    )
  ) as Record<GameSide, string>;
  const people = Object.values(seats);
  const spaceId = (await spaceLinkOf(w)).split('/space/')[1] ?? '';
  for (const person of people) {
    await w.s.apply(partition, person);
    await w.s.apply(refreshActorConnection, person);
  }
  await w.s.apply(playCustomGameHistory, {
    spaceId,
    white: seats.white,
    black: seats.black,
    ...(seats.red === undefined ? {} : { red: seats.red }),
    ...(seats.blue === undefined ? {} : { blue: seats.blue }),
    moves: line.slice(0, -1),
  });
  await w.s.apply(restoreNetwork);
  for (const person of people)
    await w.s.until((s) => customGameView(s, person), {
      pred: (shown) =>
        shown.connected && shown.current?.moves.length === line.length - 1,
      maxMs: 30_000,
    });
  await rememberCustomGame(w);
}

/** The scenario's person whose member identity is `id`. */
async function personOn(w: HarnessWorld, id: string): Promise<string> {
  for (const person of ['alice', 'bob', 'carol', 'dave', 'eve'])
    if (
      (await w.s.read((s) => s.actors.has(person))) &&
      (await w.s.read(customGameView, person)).myId === id
    )
      return person;
  throw new Error(`Nobody in the scenario is ${id}`);
}

/** Remember that the custom game follows `line`, set up by the scenario's own steps. */
export function followsKnownLine(
  w: HarnessWorld,
  line: readonly string[]
): void {
  w.memo.set(KNOWN_LINE, line);
}

/**
 * The secret choices `side` may make in the round opening after `ply`
 * moves of `line`, as the game accepts them from that side's own hand: the
 * one the known line makes first, then others its rules offer.
 */
export function secretChoicesOf(
  game: HarnessGame,
  line: readonly string[],
  ply: number,
  side: GameSide
): readonly string[] {
  const rules = playedRulesOf(game);
  const hands = game.shared.turnGame.rules.hands;
  const commit = hands?.commit;
  if (hands === undefined || commit === undefined)
    throw new Error(`${game.label} has no secret choices`);
  const at = splitDealtPosition(rules.replay(line, ply));
  const committing = commit.sides(at.position);
  const index = committing.indexOf(side);
  if (index === -1)
    throw new Error(
      `${game.label}: the ${side} side makes no secret choice after ${String(ply)} moves`
    );
  const hand = hands.hand(at.hidden, side);
  const offered = [line[ply] ?? '', ...rules.legal(rules.replay(line, ply))]
    .map((proposal) => splitCommittedProposal(proposal)?.[index])
    .flatMap((own) => {
      if (own === undefined) return [];
      const acceptance = commit.accept(at.position, side, hand, own);
      return 'commitment' in acceptance ? [acceptance.commitment] : [];
    });
  return [...new Set(offered)];
}
