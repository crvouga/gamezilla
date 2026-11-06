import {
  boardArgs,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  type Card,
  parseCards,
  writeCards,
} from '@libs/hearts-shared-ts/hearts-cards';
import {
  dealFrom,
  shufflerFrom,
  twoOfClubsSeat,
} from '@libs/hearts-shared-ts/hearts-hidden';
import {
  encodeHearts,
  INITIAL_HEARTS,
  passTarget,
  type Seat,
  sideOfSeat,
} from '@libs/hearts-shared-ts/hearts-position';
import { legalCards, seatToPlay } from '@libs/hearts-shared-ts/hearts-tricks';
import { GAME_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import { createSignal } from 'solid-js';
import { heartsPresentation } from './hearts-presentation';

export function journeyValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Missing Hearts journey fixture value');
  return value;
}

export const journeyDeal = dealFrom(shufflerFrom([7, 11, 13, 17]));
export function receivedHands(pass: readonly Card[]) {
  const outgoing = journeyDeal.hands.map((hand, seat) =>
    seat === 0 ? pass : hand.slice(0, 3)
  );
  return journeyDeal.hands.map((hand, seat) => {
    const from = journeyValue(
      [0, 1, 2, 3].find((source) => passTarget(source as Seat, 1) === seat)
    );
    return [
      ...hand.filter((card) => !journeyValue(outgoing[seat]).includes(card)),
      ...journeyValue(outgoing[from]),
    ];
  });
}

export function renderPassJourney(
  context: Parameters<typeof renderGameTable>[3]
) {
  const [position, setPosition] = createSignal(INITIAL_HEARTS);
  const [hands, setHands] = createSignal(journeyDeal.hands);
  const seat = () => seatToPlay(position()) ?? 0;
  return renderGameTable(
    heartsPresentation,
    GAME_SIDES,
    {
      ...boardArgs(encodeHearts(INITIAL_HEARTS), { interactive: true }),
      get position() {
        return encodeHearts(position());
      },
      get orientation() {
        return sideOfSeat(seat());
      },
      get hand() {
        return writeCards(journeyValue(hands()[seat()]));
      },
      onAction: (action) => {
        if (position().phase === 'pass') {
          const pass = parseCards(action);
          if (pass?.length !== 3) throw new Error('Expected three cards');
          const next = receivedHands(pass);
          setHands(next);
          setPosition({
            ...INITIAL_HEARTS,
            phase: 'play',
            lead: twoOfClubsSeat({ ...journeyDeal, hands: next }),
          });
          return;
        }
        const actor = seat();
        const card = legalCards(
          position(),
          actor,
          journeyValue(hands()[actor])
        ).find((card) => card === action);
        if (card === undefined) throw new Error('Illegal play');
        setHands(
          hands().map((hand, index) =>
            index === actor ? hand.filter((held) => held !== card) : hand
          )
        );
        setPosition({ ...position(), plays: [...position().plays, card] });
      },
    },
    context
  );
}
