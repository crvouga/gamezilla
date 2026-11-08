import { parseCards, writeCards } from '@libs/hearts-shared-ts/hearts-cards';
import {
  decodeHearts,
  passDirection,
} from '@libs/hearts-shared-ts/hearts-position';
import { t } from '@lingui/core/macro';
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
import { createEffect, createMemo, createSignal, type JSX, on } from 'solid-js';
import { passAction, passHeading } from './hearts-copy';
import {
  handCards,
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
  chosen: readonly string[]
): CardTablePass | undefined {
  if (props.hand === null) return undefined;
  const cards =
    props.commitment === null ? chosen : (parseCards(props.commitment) ?? []);
  return {
    label: passHeading(directionOf(props.position), props.commitment !== null),
    size: 3,
    cards: cards.map((card) => tableCard(card as never)),
  };
}

/** Pass, named by where the cards go, beside how many are chosen. */
function passButton(
  props: GameBoardProps,
  chosen: readonly string[],
  sending: boolean,
  onActivate: () => void
): CardTableAction {
  return {
    label: sending
      ? t`Passing your cards…`
      : passAction(directionOf(props.position)),
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

/**
 * The Hearts table: four seats around the trick, the viewer nearest, and
 * the viewer's own hand. While passing, three cards are chosen and passed
 * together; while playing, a card the rules allow is played at once, and
 * one they refuse says why. A watcher sees the table and no hand.
 */
export function HeartsBoard(props: GameBoardProps): JSX.Element {
  const [selected, setSelected] = createSignal<readonly string[]>([]);
  // A pass sent and not yet answered: shown in progress, not sent twice.
  const [sending, setSending] = createSignal(false);
  // Memos, so a prop read again with the same value resets nothing.
  const position = createMemo(() => props.position);
  const commitment = createMemo(() => props.commitment);
  const syncKey = createMemo(() => props.syncKey);
  // A new position, or a pass made, ends the choice in progress.
  createEffect(
    on([position, commitment], () => {
      setSelected([]);
      setSending(false);
    })
  );
  // A refused or failed pass resets the board: the chosen cards stay, so
  // the person can send them again.
  createEffect(on(syncKey, () => setSending(false), { defer: true }));
  const passing = () => decodeHearts(props.position)?.phase === 'pass';
  const held = () => parseCards(props.hand ?? '') ?? [];
  // Only cards still held are ever chosen.
  const chosen = () =>
    selected().filter((card) => held().includes(card as never));
  const choose = (card: string): void => {
    if (!props.interactive || sending()) return;
    if (!passing()) {
      props.onAction(card);
      return;
    }
    setSelected((now) =>
      now.includes(card)
        ? now.filter((other) => other !== card)
        : now.length < 3
          ? [...now, card]
          : now
    );
  };
  const players = useSeatPlayers();
  // A seated player whose cards are still on their way, told so rather
  // than shown an empty hand.
  const awaitingHand = () => props.interactive && props.hand === null;
  return (
    <CardTable
      label={t`Hearts table`}
      testId={props.testId}
      seats={tableSeats(props, players?.content)}
      center={
        sending()
          ? t`Passing your cards…`
          : awaitingHand()
            ? t`Your cards are on their way.`
            : tableCenter(
                props,
                props.hand === null ? null : props.orientation,
                (side) => players?.nameOf(side) ?? null
              )
      }
      // The game's turn line beside the table says the same sentence.
      centerSpokenOnly={!awaitingHand()}
      trick={decodeHearts(props.position)?.phase === 'play'}
      pass={passing() ? passShown(props, chosen()) : undefined}
      hand={handCards(props, chosen()).map((card) =>
        // A pass on its way locks the hand: the chosen cards stay lifted.
        sending() ? { ...card, enabled: false } : card
      )}
      handLabel={t`Your hand`}
      handInstruction={
        !passing() && props.interactive && props.hand !== null
          ? t`Your turn. Play a card without ×.`
          : undefined
      }
      cardTestId={(id) => `${props.testId}-card-${id}`}
      onCard={choose}
      action={
        passing() &&
        props.hand !== null &&
        props.commitment === null &&
        (props.interactive || sending())
          ? passButton(props, chosen(), sending(), () => {
              setSending(true);
              props.onAction(writeCards(chosen() as never));
            })
          : undefined
      }
      dataSet={{ position: props.position }}
    />
  );
}
