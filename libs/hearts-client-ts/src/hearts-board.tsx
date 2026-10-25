import { writeCards } from '@libs/hearts-shared-ts/hearts-cards';
import { decodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import { t } from '@lingui/core/macro';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { CardTable } from '@pkgs/ui-root-client-ts/card-table';
import { createEffect, createSignal, type JSX, on } from 'solid-js';
import { handCards, tableCenter, tableSeats } from './hearts-table-view';

/**
 * The Hearts table: four seats around the trick, the viewer nearest, and
 * the viewer's own hand. While passing, three cards are chosen and passed
 * together; while playing, a card the rules allow is played at once. A
 * watcher sees the table and no hand.
 */
export function HeartsBoard(props: GameBoardProps): JSX.Element {
  const [selected, setSelected] = createSignal<readonly string[]>([]);
  // A new position, or the board being reset, clears a choice in progress.
  createEffect(
    on(
      () => [props.position, props.syncKey] as const,
      () => setSelected([])
    )
  );
  const passing = () => decodeHearts(props.position)?.phase === 'pass';
  const choose = (card: string): void => {
    if (!props.interactive) return;
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
  const count = () => selected().length;
  return (
    <CardTable
      label={t`Hearts table`}
      testId={props.testId}
      seats={tableSeats(props)}
      center={tableCenter(props)}
      hand={handCards(props, selected())}
      handLabel={t`Your hand`}
      cardTestId={(id) => `${props.testId}-card-${id}`}
      onCard={choose}
      action={
        passing() && props.interactive && props.commitment === null
          ? {
              label: t`Pass ${count()} of 3 cards`,
              enabled: count() === 3,
              testId: `${props.testId}-pass`,
              onActivate: () => props.onAction(writeCards(selected() as never)),
            }
          : undefined
      }
      dataSet={{ position: props.position }}
    />
  );
}
