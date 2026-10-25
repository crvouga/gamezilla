import {
  type Card,
  parseCards,
  suitOf,
} from '@libs/hearts-shared-ts/hearts-cards';
import {
  decodeHearts,
  type HeartsPosition,
  passDirection,
  type Seat,
  seatAfter,
  seatOfSide,
  sideOfSeat,
} from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import {
  heartsBroken,
  playedBy,
  seatToPlay,
  takenPoints,
  tricksOf,
  trickWinner,
} from '@libs/hearts-shared-ts/hearts-tricks';
import { t } from '@lingui/core/macro';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type {
  CardTableCard,
  CardTablePosition,
  CardTableSeat,
} from '@pkgs/ui-root-client-ts/card-table';
import {
  cardName,
  heartsSeatName,
  passInstruction,
  rankText,
  SUIT_NAMES,
} from './hearts-copy';

const POSITIONS: readonly CardTablePosition[] = ['bottom', 'left', 'top', 'right'];

export function tableCard(card: Card): CardTableCard {
  return {
    id: card,
    rank: rankText(card),
    suit: SUIT_NAMES[suitOf(card)],
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

function seatFacts(
  position: HeartsPosition,
  seat: Seat,
  committed: readonly string[]
): string[] {
  const held = position.phase === 'done' ? 0 : 13 - playedBy(position, seat).length;
  const score = position.scores[seat] ?? 0;
  const taken = takenPoints(position)[seat] ?? 0;
  const facts = [t`${held} cards`, t`Score ${score}`];
  if (position.phase === 'play') facts.push(t`Taken ${taken}`);
  if (position.phase === 'pass')
    facts.push(committed.includes(sideOfSeat(seat)) ? t`Passed` : t`Choosing`);
  return facts;
}

/** The four seats, the viewer's own nearest. */
export function tableSeats(
  props: Pick<
    GameBoardProps,
    'position' | 'orientation' | 'committed' | 'testId' | 'hand'
  >
): readonly CardTableSeat[] {
  const position = decodeHearts(props.position);
  if (position === null) return [];
  const near = seatOfSide(props.orientation);
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
      name: offset === 0 && props.hand !== null ? t`${name} (you)` : name,
      facts: seatFacts(position, seat, props.committed),
      active:
        position.phase === 'pass'
          ? !props.committed.includes(side)
          : deciding === seat,
      played: played === undefined ? null : tableCard(played),
      testId: `${props.testId}-seat-${side}`,
    };
  });
}

/** What the table is doing, in one sentence. */
export function tableCenter(
  props: Pick<GameBoardProps, 'position' | 'commitment'>
): string {
  const position = decodeHearts(props.position);
  if (position === null) return '';
  if (position.phase === 'done') {
    const scores = position.scores.join(', ');
    return t`The game is over. Final scores: ${scores}.`;
  }
  if (position.phase === 'pass')
    return props.commitment === null
      ? passInstruction(passDirection(position.deal))
      : t`Your cards are chosen. Waiting for every player to pass.`;
  const trick = shownTrick(position);
  const deciding = seatToPlay(position);
  const next = deciding === null ? '' : heartsSeatName(sideOfSeat(deciding));
  if (trick !== null && trick.cards.length === 4) {
    const taker = heartsSeatName(sideOfSeat(trickWinner(trick)));
    return t`${taker} took the trick and leads.`;
  }
  const broken = heartsBroken(position) ? t`Hearts are broken.` : '';
  return `${t`${next} to play.`} ${broken}`.trim();
}

/** The viewer's held cards, each with whether the rules let them play or pass it now. */
export function handCards(
  props: Pick<GameBoardProps, 'position' | 'hand' | 'interactive' | 'commitment'>,
  selected: readonly string[]
) {
  const position = decodeHearts(props.position);
  const held = parseCards(props.hand ?? '') ?? [];
  const legal =
    position?.phase === 'play' && props.interactive
      ? heartsRules.hands!.proposals(props.position, props.hand ?? '')
      : [];
  const passing = position?.phase === 'pass';
  const passed = parseCards(props.commitment ?? '') ?? [];
  return held.map((card) => ({
    ...tableCard(card),
    enabled: passing
      ? props.interactive && props.commitment === null
      : legal.includes(card),
    selected: passing && (selected.includes(card) || passed.includes(card)),
  }));
}
