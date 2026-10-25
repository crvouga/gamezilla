import { heartsBots } from '@libs/hearts-shared-ts/hearts-bot';
import { HEARTS_SIDES } from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import type {
  BotDifficulty,
  GameSide,
  PlayedPosition,
} from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * A Hearts table as its authority holds it, for the rules' own tests: the
 * public position and actions every reader sees, and the hidden state —
 * every hand and the shuffler — which only the authority holds. It plays
 * through the registered rules alone: the same `hands.resolve`,
 * `hands.commit` and `play` the room calls.
 */
export type Table = {
  position: string;
  history: string;
  actions: string[];
  hidden: string;
  commitments: Partial<Record<GameSide, string>>;
  /** Every result the rules named, in order. */
  steps: PlayedPosition[];
};

const hands = heartsRules.hands!;
const commit = hands.commit!;

export function newTable(
  hidden: string,
  position = heartsRules.initial()
): Table {
  return {
    position,
    history: '',
    actions: [],
    hidden,
    commitments: {},
    steps: [],
  };
}

/** A table the authority dealt with `random`, as the room deals. */
export function dealtTable(random: () => number): Table {
  return newTable(hands.deal(heartsRules.initial(), random));
}

/** `side`'s cards held now. */
export function handOf(table: Table, side: GameSide): string {
  return hands.hand(table.hidden, side);
}

function record(table: Table, action: string, hidden: string): void {
  const played = heartsRules.play(
    table.position,
    action,
    table.history,
    table.actions
  );
  if (played === null)
    throw new Error(`the rules refused the resolved ${action}`);
  table.position = played.position;
  table.history = played.history;
  table.actions.push(action);
  table.steps.push(played);
  table.hidden = hidden;
}

/** The sides still to pass. */
export function pendingPasses(table: Table): readonly GameSide[] {
  return commit
    .sides(table.position)
    .filter((side) => table.commitments[side] === undefined);
}

/** `side` passes `cards`; the last pass is resolved at once. `false` when refused. */
export function pass(table: Table, side: GameSide, cards: string): boolean {
  if (!pendingPasses(table).includes(side)) return false;
  const accepted = commit.accept(
    table.position,
    side,
    handOf(table, side),
    cards
  );
  if ('refusal' in accepted) return false;
  table.commitments[side] = accepted.commitment;
  if (pendingPasses(table).length > 0) return true;
  const resolution = commit.resolve(
    table.position,
    table.commitments,
    table.hidden
  );
  table.commitments = {};
  record(table, resolution.action, resolution.hidden);
  return true;
}

/** The side to play plays `card`. `false` when the authority refuses it. */
export function play(table: Table, card: string): boolean {
  if (pendingPasses(table).length > 0) return false;
  const resolution = hands.resolve(table.position, card, table.hidden);
  if ('refusal' in resolution) return false;
  record(table, resolution.action, resolution.hidden);
  return true;
}

/** The side to play, by the last result the rules named. */
export function turn(table: Table): GameSide {
  return table.steps.at(-1)?.turn ?? 'white';
}

/** Whether the match is over. */
export function finished(table: Table): boolean {
  return table.steps.at(-1)?.winner != null;
}

/** Every seat decides as its bot at `difficulty` until the match ends or `limit` decisions pass. */
export function playBots(
  table: Table,
  random: () => number,
  options: { difficulty?: BotDifficulty; limit?: number } = {}
): void {
  const limit = options.limit ?? 5000;
  for (let decision = 0; decision < limit && !finished(table); decision += 1) {
    const passing = pendingPasses(table);
    const side = passing[0] ?? turn(table);
    const choice = heartsBots.choose(
      table.position,
      options.difficulty ?? 'medium',
      random,
      handOf(table, side)
    );
    if (choice === null) throw new Error(`the ${side} bot had nothing to do`);
    const accepted =
      passing.length > 0 ? pass(table, side, choice) : play(table, choice);
    if (!accepted) throw new Error(`the ${side} bot's ${choice} was refused`);
  }
}

export { HEARTS_SIDES };
