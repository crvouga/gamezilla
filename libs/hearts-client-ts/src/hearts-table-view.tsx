import {
  type Card,
  parseCards,
  suitOf,
} from '@libs/hearts-shared-ts/hearts-cards';
import {
  decodeHearts,
  type HeartsPosition,
  passDirection,
  passTarget,
  type Seat,
  seatAfter,
  seatOfSide,
  sideOfSeat,
} from '@libs/hearts-shared-ts/hearts-position';
import {
  cardRefusal,
  heartsBroken,
  lowestSeats,
  playedBy,
  seatToPlay,
  takenPoints,
  tricksOf,
  trickWinner,
} from '@libs/hearts-shared-ts/hearts-tricks';
import { plural, t } from '@lingui/core/macro';
import type { GamePlayerName } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type {
  CardTableCard,
  CardTablePosition,
  CardTableSeat,
} from '@pkgs/ui-root-client-ts/card-table';
import type { JSX } from 'solid-js';
import {
  cardName,
  heartsRefusal,
  heartsSeatName,
  passInstructionTo,
  passWaiting,
  rankText,
  SUIT_NAMES,
  suitName,
} from './hearts-copy';

const POSITIONS: readonly CardTablePosition[] = [
  'bottom',
  'left',
  'top',
  'right',
];

export function tableCard(card: Card): CardTableCard {
  return {
    id: card,
    rank: rankText(card),
    suit: SUIT_NAMES[suitOf(card)],
    suitName: suitName(suitOf(card)),
    label: cardName(card),
  };
}

/**
 * The trick to show: the one under way, or, between tricks, the one just
 * taken (so everyone sees who took it until the next card is played).
 */
function shownTrick(position: HeartsPosition) {
  const tricks = tricksOf(position);
  return tricks.at(-1) ?? null;
}

/**
 * What a seat holds and has scored: its cards left, its score, and while
 * tricks are played the points it has taken this deal.
 */
function seatFacts(position: HeartsPosition, seat: Seat): string[] {
  const held =
    position.phase === 'done' ? 0 : 13 - playedBy(position, seat).length;
  const score = position.scores[seat] ?? 0;
  const taken = takenPoints(position)[seat] ?? 0;
  const facts = [
    plural(held, { one: '# card', other: '# cards' }),
    t`Score ${score}`,
  ];
  if (position.phase === 'play') facts.push(t`Deal points ${taken}`);
  return facts;
}

/** While cards are passed, whether the seat has passed or still chooses. */
function seatStatus(
  position: HeartsPosition,
  seat: Seat,
  committed: readonly string[]
): string | undefined {
  if (position.phase !== 'pass') return undefined;
  return committed.includes(sideOfSeat(seat)) ? t`Passed` : t`Choosing`;
}

/** The four seats, the viewer's own nearest. */
export function tableSeats(
  board: Pick<
    GameBoardProps,
    'position' | 'orientation' | 'committed' | 'testId' | 'hand'
  >,
  player?: (side: GameSide) => JSX.Element | undefined
): readonly CardTableSeat[] {
  const position = decodeHearts(board.position);
  if (position === null) return [];
  const near = seatOfSide(board.orientation);
  const trick = shownTrick(position);
  const deciding = seatToPlay(position);
  return POSITIONS.map((place, offset) => {
    const seat = seatAfter(near, offset);
    const side = sideOfSeat(seat);
    const index = trick === null ? -1 : (seat - trick.leader + 4) % 4;
    const played = trick?.cards[index];
    const name = heartsSeatName(side);
    return {
      position: place,
      // A player's own seat says so; a watcher has no seat of their own.
      name: offset === 0 && board.hand !== null ? t`${name} (you)` : name,
      facts: seatFacts(position, seat),
      status: seatStatus(position, seat, board.committed),
      player: player?.(side),
      active:
        position.phase === 'pass'
          ? !board.committed.includes(side)
          : deciding === seat,
      played: played === undefined ? null : tableCard(played),
      testId: `${board.testId}-seat-${side}`,
    };
  });
}

/** Who has passed so far, by seat, as a sentence; never what they passed. */
function passingProgress(committed: readonly GameSide[]): string {
  if (committed.length === 0) return t`Nobody has passed yet.`;
  const names = committed.map(heartsSeatName);
  const last = names.at(-1) ?? '';
  if (names.length === 1) return t`${last} has passed.`;
  const head = names.slice(0, -1).join(', ');
  return t`${head} and ${last} have passed.`;
}

/** Every seat's score, named: `South 10, West 20, North 30, East 40`. */
function namedScores(scores: readonly number[]): string {
  return scores
    .map((score, seat) => {
      const name = heartsSeatName(sideOfSeat(seat as Seat));
      return t`${name} ${score}`;
    })
    .join(', ');
}

/** The match's result: every final score, and who won with the lowest. */
function finalResult(position: HeartsPosition): string {
  const scores = namedScores(position.scores);
  const winners = lowestSeats(position.scores).map((seat) =>
    heartsSeatName(sideOfSeat(seat))
  );
  const last = winners.at(-1) ?? '';
  if (winners.length === 1)
    return t`The game is over. Final scores: ${scores}. ${last} wins.`;
  const head = winners.slice(0, -1).join(', ');
  return t`The game is over. Final scores: ${scores}. ${head} and ${last} win.`;
}

/**
 * What the deal just played added to each score, while the next deal has
 * not yet had a card played: its last trick leaves the table with it.
 */
function lastDeal(position: HeartsPosition): string {
  if (position.last === null || position.plays.length > 0) return '';
  const added = namedScores(position.last);
  return t`Last deal added: ${added}.`;
}

/** An unknown or blank identity keeps its meaningful seat label. */
function playerName(side: GameSide, nameOf: GamePlayerName): string {
  const name = nameOf(side)?.trim();
  return name === undefined || name === '' ? heartsSeatName(side) : name;
}

/**
 * Who gets `viewer`'s pass this deal, by name (or seat when unnamed);
 * `null` for a watcher or a deal without passing.
 */
export function passRecipient(
  position: string,
  viewer: GameSide | null,
  nameOf: GamePlayerName
): string | null {
  const decoded = decodeHearts(position);
  if (viewer === null || decoded === null) return null;
  if (passDirection(decoded.deal) === 'hold') return null;
  const target = passTarget(seatOfSide(viewer), decoded.deal);
  return playerName(sideOfSeat(target), nameOf);
}

/** What the table is doing, naming the player independently of rendered seats. */
export function tableCenter(
  board: Pick<GameBoardProps, 'position' | 'commitment' | 'committed'>,
  viewer: GameSide | null,
  nameOf: GamePlayerName
): string {
  const position = decodeHearts(board.position);
  if (position === null) return '';
  if (position.phase === 'done') return finalResult(position);
  const summary = lastDeal(position);
  if (position.phase === 'pass') {
    const progress = passingProgress(board.committed);
    const now =
      board.commitment === null
        ? `${passInstructionTo(passDirection(position.deal), passRecipient(board.position, viewer, nameOf))} ${progress}`
        : `${passWaiting()} ${progress}`;
    return `${summary} ${now}`.trim();
  }
  const trick = shownTrick(position);
  const deciding = seatToPlay(position);
  const next =
    deciding === null ? '' : playerName(sideOfSeat(deciding), nameOf);
  const winner = trick?.cards.length === 4 ? trickWinner(trick) : null;
  const winning =
    trick === null || winner === null
      ? undefined
      : trick.cards[(winner - trick.leader + 4) % 4];
  if (winner !== null && winning !== undefined) {
    const taker = playerName(sideOfSeat(winner), nameOf);
    const named = cardName(winning);
    // The card's name inside the sentence: `the king of diamonds`.
    const card = `${named.charAt(0).toLocaleLowerCase()}${named.slice(1)}`;
    return sideOfSeat(winner) === viewer
      ? t`You took the trick with the ${card} and lead.`
      : t`${taker} took the trick with the ${card} and leads.`;
  }
  const broken = heartsBroken(position) ? t`Hearts are broken.` : '';
  const turn =
    deciding !== null && sideOfSeat(deciding) === viewer
      ? t`Your turn.`
      : t`${next} to play.`;
  return `${summary} ${turn} ${broken}`.trim();
}

/**
 * The viewer's held cards, each with whether the rules let them play or pass
 * it now, and why not. While passing, the chosen cards: the pass made, once
 * made, else the cards being chosen; while playing, a card acts at once.
 */
export function handCards(
  board: Pick<
    GameBoardProps,
    'position' | 'hand' | 'interactive' | 'commitment' | 'orientation'
  >,
  selected: readonly string[]
) {
  const position = decodeHearts(board.position);
  const held = parseCards(board.hand ?? '') ?? [];
  const passing = position?.phase === 'pass';
  const passed = parseCards(board.commitment ?? '') ?? [];
  const chosen = board.commitment === null ? selected : passed;
  const seat = seatOfSide(board.orientation);
  const refusal = (card: Card): string | undefined => {
    if (position?.phase !== 'play') return undefined;
    const reason = cardRefusal(position, seat, held, card);
    return reason === null ? undefined : heartsRefusal(reason);
  };
  return [...held]
    .sort(
      (a, b) =>
        Number(refusal(a) !== undefined) - Number(refusal(b) !== undefined)
    )
    .map((card) => {
      const reason = refusal(card);
      return {
        ...tableCard(card),
        enabled: passing
          ? board.interactive && board.commitment === null
          : board.interactive && reason === undefined,
        selected: passing ? chosen.includes(card) : null,
        refusal: reason,
      };
    });
}
