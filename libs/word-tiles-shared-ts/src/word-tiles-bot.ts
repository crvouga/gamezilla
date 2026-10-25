import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import { formatProposal } from './word-tiles-action';
import { parseHand } from './word-tiles-hidden';
import type { Lexicon } from './word-tiles-lexicon';
import { type GeneratedMove, generateMoves } from './word-tiles-moves';
import type { WordTilesPosition } from './word-tiles-position';
import { RULESET } from './word-tiles-ruleset';
import { BLANK, tileOf } from './word-tiles-tiles';

/**
 * A bot sees what its seat may see — the public position and its own rack —
 * and the public lexicon. It proposes like a person, and the authority
 * checks its proposal like anyone's. Strength differs only by documented
 * search and selection limits:
 *
 * | strength | trie steps searched | chooses among |
 * | --- | --- | --- |
 * | easy | 5 000 | the lower-scoring half of what it found, at random |
 * | medium | 40 000 | the three best-scoring found, at random |
 * | hard | 300 000 | the best score, then the better tiles kept |
 *
 * Without a placement it exchanges (when the bag allows) its worst tiles,
 * else it passes. Ties break by the seeded `random`, so a replay decides
 * alike; no strength reads another rack or the bag.
 */
export const BOT_BUDGETS: Readonly<Record<BotDifficulty, number>> = {
  easy: 5_000,
  medium: 40_000,
  hard: 300_000,
};

function pick<T>(items: readonly T[], random: () => number): T {
  return items[
    Math.min(items.length - 1, Math.floor(random() * items.length))
  ]!;
}

/** How much worse a rack left behind is: duplicates, a lone Q, vowel imbalance. */
export function leavePenalty(rack: readonly number[]): number {
  const symbols = rack.map((id) => tileOf(id)?.symbol ?? '');
  const counts = new Map<string, number>();
  for (const s of symbols) counts.set(s, (counts.get(s) ?? 0) + 1);
  let penalty = 0;
  for (const [symbol, count] of counts)
    if (symbol !== BLANK && count > 1) penalty += (count - 1) * 2;
  if (counts.has('Q') && !counts.has('U')) penalty += 6;
  const vowels = symbols.filter((s) => 'AEIOU'.includes(s)).length;
  penalty += Math.abs(vowels - (symbols.length - vowels));
  return penalty - (counts.get(BLANK) ?? 0) * 4 - (counts.get('S') ?? 0) * 2;
}

function leaveAfter(rack: readonly number[], move: GeneratedMove): number {
  const used = new Set(move.tiles.map((t) => t.tile));
  return leavePenalty(rack.filter((id) => !used.has(id)));
}

function select(
  moves: readonly GeneratedMove[],
  rack: readonly number[],
  difficulty: BotDifficulty,
  random: () => number
): GeneratedMove {
  const ranked = [...moves].sort((a, b) => b.score - a.score);
  if (difficulty === 'easy')
    return pick(ranked.slice(Math.floor(ranked.length / 2)), random);
  if (difficulty === 'medium') return pick(ranked.slice(0, 3), random);
  const best = ranked[0]!.score;
  const top = ranked.filter((m) => m.score === best);
  const leave = Math.min(...top.map((m) => leaveAfter(rack, m)));
  return pick(
    top.filter((m) => leaveAfter(rack, m) === leave),
    random
  );
}

/** The tiles a stuck bot returns: everything but blanks and S. */
function exchangeChoice(rack: readonly number[]): readonly number[] {
  const kept = new Set([BLANK, 'S']);
  const out = rack.filter((id) => !kept.has(tileOf(id)?.symbol ?? ''));
  return out.length > 0 ? out : rack;
}

/** The proposal a bot of `difficulty` makes at `position` holding `hand`. */
export function chooseWordTilesProposal(input: {
  readonly position: WordTilesPosition;
  readonly hand: string;
  readonly lexicon: Lexicon;
  readonly difficulty: BotDifficulty;
  readonly random: () => number;
}): string | null {
  const { position, lexicon, difficulty, random } = input;
  if (position.ended !== null) return null;
  const rack = parseHand(input.hand);
  if (rack === null) throw new Error('a bot was given an unreadable rack');
  const search = generateMoves({
    board: position.board,
    rack,
    trie: lexicon.trie,
    budget: BOT_BUDGETS[difficulty],
  });
  if (search.moves.length > 0) {
    const move = select(search.moves, rack, difficulty, random);
    return formatProposal({ kind: 'place', tiles: move.tiles });
  }
  if (position.bag >= RULESET.exchangeMinimumBag && rack.length > 0)
    return formatProposal({ kind: 'exchange', tiles: exchangeChoice(rack) });
  return 'pass';
}
