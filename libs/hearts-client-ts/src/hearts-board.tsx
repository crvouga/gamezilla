import { parseCards, writeCards } from '@libs/hearts-shared-ts/hearts-cards';
import { decodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import { t } from '@lingui/core/macro';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { CardTable } from '@pkgs/ui-root-client-ts/card-table';
import { createEffect, createMemo, createSignal, type JSX, on } from 'solid-js';
import { handCards, tableCenter, tableSeats } from './hearts-table-view';

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
  const count = () => chosen().length;
  // A seated player whose cards are still on their way, told so rather
  // than shown an empty hand.
  const awaitingHand = () => props.interactive && props.hand === null;
  return (
    <CardTable
      label={t`Hearts table`}
      testId={props.testId}
      seats={tableSeats(props)}
      center={
        awaitingHand() ? t`Your cards are on their way.` : tableCenter(props)
      }
      hand={handCards(props, chosen())}
      handLabel={t`Your hand`}
      cardTestId={(id) => `${props.testId}-card-${id}`}
      onCard={choose}
      action={
        passing() &&
        props.hand !== null &&
        props.commitment === null &&
        (props.interactive || sending())
          ? {
              label: sending()
                ? t`Passing your cards…`
                : t`Pass ${count()} of 3 cards`,
              enabled: count() === 3,
              pending: sending(),
              testId: `${props.testId}-pass`,
              onActivate: () => {
                setSending(true);
                props.onAction(writeCards(chosen() as never));
              },
            }
          : undefined
      }
      dataSet={{ position: props.position }}
    />
  );
}
