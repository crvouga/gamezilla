import { parseCards, writeCards } from '@libs/hearts-shared-ts/hearts-cards';
import {
  decodeHearts,
  passDirection,
} from '@libs/hearts-shared-ts/hearts-position';
import { t } from '@lingui/core/macro';
import { createHeartsInput } from '@pkgs/hearts-board-client-ts/input';
import type { GamePlayerName } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  GAME_SIDES,
  type GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  CardTable,
  type CardTableAction,
  type CardTablePass,
} from '@pkgs/ui-root-client-ts/card-table';
import { useGameTableSeat } from '@pkgs/ui-root-client-ts/game-table-seat';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal } from 'solid-js';
import { passActionTo, passHeadingTo, passWaiting } from './hearts-copy';
import {
  handCards,
  heartsWaiting,
  passRecipient,
  tableCard,
  tableCenter,
  tableSeats,
} from './hearts-table-view';

/**
 * The person in each seat, when the screen around the board lends them:
 * drawn once each, so the table moves them, never redraws them.
 */
function useSeatPlayers():
  | { content: (side: GameSide) => JSX.Element; nameOf: GamePlayerName }
  | undefined {
  const lend = useGameTableSeat();
  if (lend === undefined) return undefined;
  const players = new Map(
    GAME_SIDES.map((side) => [side, lend(side)] as const)
  );
  return {
    content: (side) => players.get(side)?.content,
    nameOf: (side) => players.get(side)?.name ?? null,
  };
}

function directionOf(position: string) {
  return passDirection(decodeHearts(position)?.deal ?? 1);
}

/**
 * The pass in the middle of the table, for a seated player: where it goes,
 * and the cards passed once passed, else those being chosen.
 */
function passShown(
  props: GameBoardProps,
  chosen: readonly string[],
  recipient: string | null
): CardTablePass | undefined {
  if (props.hand === null) return undefined;
  const cards =
    props.commitment === null ? chosen : (parseCards(props.commitment) ?? []);
  return {
    label: passHeadingTo(
      directionOf(props.position),
      props.commitment !== null,
      recipient
    ),
    size: 3,
    cards: cards.map((card) => tableCard(card as never)),
  };
}

/** The pass button while a seated player can pass, or is passing; else none. */
function passControl(
  props: GameBoardProps,
  pass: PassState,
  onSend: () => void
): CardTableAction | undefined {
  const passing = decodeHearts(props.position)?.phase === 'pass';
  const open = props.interactive || pass.sending;
  if (!passing || props.hand === null || props.commitment !== null || !open)
    return undefined;
  return passButton(props, pass, onSend);
}

/** The table's sentence: a pass on its way, cards still coming, else the play. */
function boardCenter(
  props: GameBoardProps,
  sending: boolean,
  awaitingHand: boolean,
  nameOf: GamePlayerName
): string {
  if (sending) return t`Passing your cards…`;
  if (awaitingHand) return t`Your cards are on their way.`;
  return tableCenter(
    props,
    props.hand === null ? null : props.orientation,
    nameOf,
    true
  );
}

/** Who gets a seated player's pass this deal, so passing names a person. */
function recipientOf(
  props: GameBoardProps,
  players: ReturnType<typeof useSeatPlayers>
): string | null {
  if (props.hand === null) return null;
  return passRecipient(
    props.position,
    props.orientation,
    (side) => players?.nameOf(side) ?? null
  );
}

/** The pass in progress: the cards chosen, whether it is on its way, and who gets it. */
type PassState = {
  readonly chosen: readonly string[];
  readonly sending: boolean;
  readonly recipient: string | null;
};

/** Pass, named by who gets the cards, beside how many are chosen. */
function passButton(
  props: GameBoardProps,
  pass: PassState,
  onActivate: () => void
): CardTableAction {
  const { chosen, sending } = pass;
  return {
    label: sending
      ? t`Passing your cards…`
      : passActionTo(directionOf(props.position), pass.recipient),
    status:
      chosen.length === 3 && !sending
        ? t`3 of 3 chosen. Unselect a card to choose another.`
        : t`${chosen.length} of 3 chosen`,
    enabled: chosen.length === 3,
    pending: sending,
    testId: `${props.testId}-pass`,
    onActivate,
  };
}

function handInstruction(
  props: GameBoardProps,
  passing: boolean
): string | undefined {
  if (passing) return props.commitment === null ? undefined : passWaiting();
  return props.interactive && props.hand !== null
    ? t`Your turn. Play any card.`
    : undefined;
}

function togglePassCard(cards: readonly string[], card: string) {
  if (cards.includes(card)) return cards.filter((other) => other !== card);
  return cards.length < 3 ? [...cards, card] : cards;
}

/**
 * The Hearts table: four seats around the trick, the viewer nearest, and
 * the viewer's own hand. While passing, three cards are chosen and passed
 * together; while playing, a card the rules allow is played at once, and
 * one they refuse says why. A watcher sees the table and no hand.
 */
export function HeartsBoard(props: GameBoardProps): JSX.Element {
  const input = createHeartsInput();
  // Memos, so a prop read again with the same value resets nothing.
  const position = createMemo(() => props.position);
  const commitment = createMemo(() => props.commitment);
  const syncKey = createMemo(() => props.syncKey);
  // A new position, or a pass made, ends the choice in progress.
  const [selected, setSelected] = createSignal<readonly string[]>(() => {
    position();
    commitment();
    return [];
  });
  // A pass sent and not yet answered: shown in progress, not sent twice.
  // A refused or failed pass resets the board: the chosen cards stay, so
  // the person can send them again.
  const [sending, setSending] = createSignal(() => {
    position();
    commitment();
    syncKey();
    return false;
  });
  const passing = () => decodeHearts(props.position)?.phase === 'pass';
  const held = createMemo(() => parseCards(props.hand ?? '') ?? []);
  // Only cards still held are ever chosen.
  const chosen = createMemo(() =>
    selected().filter((card) => held().includes(card as never))
  );
  const choose = (card: string): void => {
    if (!props.interactive || sending()) return;
    if (!passing()) {
      props.onAction(card);
      return;
    }
    setSelected((now) => togglePassCard(now, card));
  };
  const players = useSeatPlayers();
  const nameOf = (side: GameSide) => players?.nameOf(side) ?? null;
  const seats = createMemo(() => tableSeats(props, players?.content));
  const hand = createMemo(() =>
    handCards(props, chosen()).map((card) =>
      sending() ? { ...card, enabled: false } : card
    )
  );
  // A seated player whose cards are still on their way, told so rather
  // than shown an empty hand.
  const awaitingHand = () => props.interactive && props.hand === null;
  return (
    <CardTable
      hearts={{ input, zoom: t`Zoom table`, fit: t`Fit table` }}
      label={t`Hearts table`}
      tableSummary={t`Players and scores`}
      testId={props.testId}
      seats={seats()}
      center={boardCenter(props, sending(), awaitingHand(), nameOf)}
      // The game's turn line beside the table says the same sentence.
      centerSpokenOnly={!awaitingHand()}
      trick={decodeHearts(props.position)?.phase === 'play'}
      pass={
        passing()
          ? passShown(props, chosen(), recipientOf(props, players))
          : undefined
      }
      hand={hand()}
      handLabel={t`Your hand`}
      handInstruction={handInstruction(props, passing())}
      handWaiting={heartsWaiting(props, nameOf)}
      cardTestId={(id) => `${props.testId}-card-${id}`}
      onCard={choose}
      action={passControl(
        props,
        {
          chosen: chosen(),
          sending: sending(),
          recipient: recipientOf(props, players),
        },
        () => {
          setSending(true);
          props.onAction(writeCards(chosen() as never));
        }
      )}
      dataSet={{ position: props.position }}
    />
  );
}
