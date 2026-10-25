import { resolveProposal } from '@libs/word-tiles-shared-ts/word-tiles-authority';
import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import {
  decodeHidden,
  encodeHidden,
  type HiddenState,
  parseHand,
} from '@libs/word-tiles-shared-ts/word-tiles-hidden';
import {
  DEFAULT_LEXICON_KEY,
  loadLexicon,
  requireLexicon,
} from '@libs/word-tiles-shared-ts/word-tiles-lexicon';
import { playEncoded } from '@libs/word-tiles-shared-ts/word-tiles-play';
import {
  decodePosition,
  EMPTY_BOARD,
  encodePosition,
  newPosition,
  type WordTilesPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import {
  encodePuzzle,
  puzzleProgress,
  readPuzzle,
  wordTilesPuzzleContent,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import {
  RULESET,
  WORD_TILES_SEATS,
} from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { BLANK, TILES } from '@libs/word-tiles-shared-ts/word-tiles-tiles';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSnapshot } from '@pkgs/harness-root-shared-ts/define-snapshot';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';
import { replayPuzzleEvidence } from '@pkgs/turn-game-shared-ts/puzzle-content';

/**
 * A table of Word Tiles as its authority keeps it — the public position,
 * the hidden state and what the last turn was told — driven through the
 * game's own authority and rules. Racks are written as letters; each
 * letter is played as one of the seat's own tiles, as a person picks one.
 */
export type WordTilesTable = {
  position: string;
  hidden: string;
  refusal: string | null;
  last: { readonly score: number; readonly words: readonly string[] } | null;
  challenge: {
    definition: string;
    state: string;
    published: boolean;
  } | null;
};

const PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;

// The table decides with the pinned word list, as a prepared authority does.
await loadLexicon(DEFAULT_LEXICON_KEY);

export type TableSetup = {
  /** Each player's rack, as letters (a blank as `?`), in seat order. */
  readonly racks: readonly string[];
  /** Words already on the board: `[first square, across or down, letters]`. */
  readonly words?: readonly (readonly [string, 'across' | 'down', string])[];
  readonly bag?: number;
  readonly scores?: readonly number[];
  readonly scoreless?: number;
  readonly turn?: number;
};

function idsOf(letters: string, taken: Set<number>): number[] {
  return [...letters].map((symbol) => {
    const tile = TILES.find((t) => t.symbol === symbol && !taken.has(t.id));
    if (tile === undefined) throw new Error(`no ${symbol} tile is left`);
    taken.add(tile.id);
    return tile.id;
  });
}

function boardWith(words: TableSetup['words']): string {
  const cells = EMPTY_BOARD.split('');
  for (const [start, direction, letters] of words ?? []) {
    const first = parseCell(start);
    if (first === null) throw new Error(`no square ${start}`);
    [...letters].forEach((letter, n) => {
      cells[first + n * (direction === 'across' ? 1 : 15)] = letter;
    });
  }
  return cells.join('');
}

/** The table a scenario describes, every tile in exactly one place. */
export function tableOf(setup: TableSetup): WordTilesTable {
  const seats = setup.racks.length as 2 | 3 | 4;
  const taken = new Set<number>();
  const racks = setup.racks.map((letters) => idsOf(letters, taken));
  const board = boardWith(setup.words);
  const onBoard = idsOf(board.replaceAll('.', ''), taken);
  const rest = TILES.map((t) => t.id).filter((id) => !taken.has(id));
  const keep = setup.bag ?? rest.length;
  const hidden: HiddenState = {
    racks,
    bag: rest.slice(0, keep),
    board: [...onBoard, ...rest.slice(keep)],
    rng: [11, 22, 33, 44],
  };
  const position: WordTilesPosition = {
    ...newPosition(seats, DEFAULT_LEXICON_KEY),
    board,
    racks: racks.map((rack) => rack.length),
    bag: hidden.bag.length,
    scores: setup.scores ?? racks.map(() => 0),
    scoreless: setup.scoreless ?? 0,
    turn: setup.turn ?? 0,
  };
  return {
    position: encodePosition(position),
    hidden: encodeHidden(hidden),
    refusal: null,
    last: null,
    challenge: null,
  };
}

function seatOf(actor: string): number {
  const seat = PEOPLE.indexOf(actor as (typeof PEOPLE)[number]);
  if (seat < 0) throw new Error(`${actor} has no seat`);
  return seat;
}

function hiddenOf(s: WordTilesTable): HiddenState {
  const position = decodePosition(s.position)!;
  return decodeHidden(s.hidden, position.seats)!;
}

/** Tiles of `actor`'s rack spelling `letters`, each used once (a blank for `?`). */
function rackTiles(
  s: WordTilesTable,
  actor: string,
  letters: string
): number[] {
  const rack = [...(hiddenOf(s).racks[seatOf(actor)] ?? [])];
  return [...letters].map((symbol) => {
    const at = rack.findIndex((id) => TILES[id]?.symbol === symbol);
    if (at < 0) return -1;
    return rack.splice(at, 1)[0]!;
  });
}

/** Decide `proposal` by `actor` as the authority does, recording a refusal. */
function decide(s: WordTilesTable, actor: string, proposal: string): void {
  s.refusal = null;
  s.last = null;
  const position = decodePosition(s.position)!;
  if (position.ended !== null) {
    s.refusal = 'the game is over';
    return;
  }
  if (WORD_TILES_SEATS[position.turn] !== WORD_TILES_SEATS[seatOf(actor)]) {
    s.refusal = 'not your turn';
    return;
  }
  const resolution = resolveProposal(
    s.position,
    proposal,
    s.hidden,
    requireLexicon(position.lexicon)
  );
  if (!resolution.ok) {
    s.refusal = resolution.refusal;
    return;
  }
  const played = playEncoded(s.position, resolution.action);
  if (played === null) throw new Error('the rules refused an accepted action');
  s.position = played.position;
  s.hidden = resolution.hidden;
  const score = played.played.score;
  s.last =
    score === null
      ? null
      : { score: score.total, words: score.words.map((w) => w.word) };
}

export type Placement = {
  readonly letter: string;
  readonly square: string;
  /** The letter a blank plays. */
  readonly as?: string;
};

/** The squares of `word` from `from` to `to` that are still empty, with their letters. */
export function wordPlacements(
  table: WordTilesTable,
  word: string,
  span: {
    readonly from: string;
    readonly to: string;
    readonly blankAs?: string;
  }
): readonly Placement[] {
  const first = parseCell(span.from);
  const last = parseCell(span.to);
  if (first === null || last === null) throw new Error('no such square');
  const step = last - first >= 15 ? 15 : 1;
  const board = decodePosition(table.position)!.board;
  return [...word].flatMap((letter, n) => {
    const cell = first + n * step;
    if (board[cell] !== '.') return [];
    const square = `${'abcdefghijklmno'[cell % 15]}${Math.floor(cell / 15) + 1}`;
    return span.blankAs === letter
      ? [{ letter: BLANK, square, as: letter }]
      : [{ letter, square }];
  });
}

export const startTable = defineAction({
  name: 'startWordTilesTable',
  act: (s: WordTilesTable, setup: TableSetup) => {
    Object.assign(s, tableOf(setup));
  },
});

function placeTilesAs(
  s: WordTilesTable,
  actor: string,
  placements: readonly Placement[]
): void {
  const tiles = rackTiles(s, actor, placements.map((p) => p.letter).join(''));
  const entries = placements.map(
    (p, n) => `${p.square}=${tiles[n] === -1 ? 999 : tiles[n]}${p.as ?? ''}`
  );
  decide(s, actor, `play:${entries.join('.')}`);
}

export const placeTiles = defineAction({
  name: 'placeWordTiles',
  act: placeTilesAs,
});

/**
 * `actor` places `word` from one square to another: its letters on the
 * squares still empty, a blank for `blankAs`; on a one-move challenge when
 * one is open.
 */
export const placeWord = defineAction({
  name: 'placeWordTilesWord',
  act: (
    s: WordTilesTable,
    actor: string,
    word: string,
    span: {
      readonly from: string;
      readonly to: string;
      readonly blankAs?: string;
    }
  ) => {
    const placements = wordPlacements(s, word, span);
    if (s.challenge !== null) {
      playChallengeTiles(s, placements);
      return;
    }
    placeTilesAs(s, actor, placements);
  },
});

export const passTurn = defineAction({
  name: 'passWordTilesTurn',
  act: (s: WordTilesTable, actor: string) => decide(s, actor, 'pass'),
});

/** Exchange `letters`; tiles `actor` does not hold are named by another seat's tiles. */
export const exchangeTiles = defineAction({
  name: 'exchangeWordTiles',
  act: (s: WordTilesTable, actor: string, letters: string) => {
    let tiles = rackTiles(s, actor, letters);
    if (tiles.includes(-1))
      tiles = hiddenOf(s)
        .racks.flat()
        .filter((id) => letters.includes(TILES[id]?.symbol ?? ''))
        .slice(0, letters.length);
    decide(s, actor, `swap:${tiles.join('.')}`);
  },
});

/** What `observer` is shown: the public position and their own rack alone. */
export function viewOf(s: WordTilesTable, observer: string) {
  const position = decodePosition(s.position)!;
  const rack = hiddenOf(s).racks[seatOf(observer)] ?? [];
  return { position, rack: parseHand(rack.join(',')) ?? [] };
}

export function rackLetters(s: WordTilesTable, actor: string): string {
  return (hiddenOf(s).racks[seatOf(actor)] ?? [])
    .map((id) => TILES[id]?.symbol ?? '')
    .sort()
    .join('');
}

export function lettersBetween(
  s: WordTilesTable,
  from: string,
  to: string
): string {
  const first = parseCell(from)!;
  const last = parseCell(to)!;
  const step = last - first >= 15 ? 15 : 1;
  const board = decodePosition(s.position)!.board;
  let word = '';
  for (let cell = first; cell <= last; cell += step) word += board[cell];
  return word;
}

/** Every tile on the board, as the board shows it (`.` for empty squares dropped). */
export function boardLetters(s: WordTilesTable): string {
  return decodePosition(s.position)!.board.replaceAll('.', '');
}

/** A one-move challenge on an empty board with `rack` and `target`. */
export const openChallenge = defineAction({
  name: 'openWordTilesChallenge',
  act: (s: WordTilesTable, rack: string, target: number) => {
    const definition = encodePuzzle({
      ruleset: RULESET.id,
      lexicon: DEFAULT_LEXICON_KEY,
      board: EMPTY_BOARD,
      rack,
      target,
    });
    const start = wordTilesPuzzleContent.rules.initial(definition);
    if (!start.accepted) throw new Error('the challenge cannot start');
    s.challenge = { definition, state: start.state, published: false };
    s.refusal = null;
    s.last = null;
  },
});

/** A challenge action naming rack positions for `placements`. */
function challengeAction(
  s: WordTilesTable,
  placements: readonly Placement[]
): string {
  const read = readPuzzle(s.challenge?.definition ?? '');
  const rack = read.valid ? [...read.value.rack] : [];
  return `play:${placements
    .map((p) => {
      const index = rack.findIndex((tile) => tile === p.letter);
      rack[index] = '';
      return `${p.square}=${index}${p.as ?? ''}`;
    })
    .join('.')}`;
}

function playChallengeTiles(
  s: WordTilesTable,
  placements: readonly Placement[]
): void {
  const challenge = s.challenge;
  if (challenge === null) throw new Error('no challenge');
  const change = wordTilesPuzzleContent.rules.apply(
    challenge.definition,
    challenge.state,
    challengeAction(s, placements)
  );
  s.refusal = change.accepted ? null : (change.issues[0]?.code ?? 'refused');
  if (change.accepted) {
    challenge.state = change.state;
    const progress = puzzleProgress(change.state);
    s.last = { score: progress.score ?? 0, words: [] };
  }
}

/** The author publishes the challenge with `placements` as its witness. */
export const publishChallenge = defineAction({
  name: 'publishWordTilesChallenge',
  act: (
    s: WordTilesTable,
    word: string,
    span: { readonly from: string; readonly to: string }
  ) => {
    const placements = wordPlacements(s, word, span);
    const challenge = s.challenge;
    if (challenge === null) throw new Error('no challenge');
    const replay = replayPuzzleEvidence(
      wordTilesPuzzleContent.rules,
      challenge.definition,
      [challengeAction(s, placements)]
    );
    const check = replay.valid
      ? wordTilesPuzzleContent.validatePublication?.(
          challenge.definition,
          replay.evidence
        )
      : replay;
    challenge.published = check?.valid === true;
    s.refusal = challenge.published ? null : 'witness';
  },
});

/** The refusal the last turn was told, as the game's rules name it. */
export function lastRefusal(s: WordTilesTable): string | null {
  return s.refusal;
}

/** The last accepted placement's score and words. */
export function lastScore(s: WordTilesTable) {
  return s.last;
}

export function challengePublished(s: WordTilesTable): boolean {
  return s.challenge?.published === true;
}

export function challengeSolved(s: WordTilesTable): boolean {
  const challenge = s.challenge;
  return (
    challenge !== null &&
    wordTilesPuzzleContent.rules.complete(challenge.definition, challenge.state)
  );
}

export const wordTilesTableSystem = defineSystem<WordTilesTable>({
  name: 'word-tiles-table',
  create: () => tableOf({ racks: ['', ''] }),
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [
    startTable,
    placeTiles,
    placeWord,
    passTurn,
    exchangeTiles,
    openChallenge,
    publishChallenge,
  ],
  snapshots: [
    defineSnapshot({
      name: 'table',
      capture: (s: WordTilesTable) => ({
        position: s.position,
        refusal: s.refusal,
        last: s.last,
      }),
    }),
  ],
});
