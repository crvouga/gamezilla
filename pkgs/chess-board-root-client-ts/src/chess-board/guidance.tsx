import { Trans } from '@lingui/solid/macro';
import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { BoardController } from '../chess-board-controller';
import styles from './chess-board.module.css';

/** Visible equivalents of board orientation and keyboard/check affordances. */
export function ChessBoardGuidance(props: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  const game = () => props.ctrl.model.game();
  return (
    <>
      <P variant="caption">
        {/* Neutral orientation: a watcher reads the same line as a player. */}
        <Show
          when={props.props.orientation === 'black'}
          fallback={<Trans>White pieces at the bottom.</Trans>}
        >
          <Trans>Black pieces at the bottom.</Trans>
        </Show>{' '}
        <Switch>
          <Match when={game().isCheckmate}>
            <Show
              when={game().turn === 'w'}
              fallback={<Trans>Black is checkmated.</Trans>}
            >
              <Trans>White is checkmated.</Trans>
            </Show>
          </Match>
          <Match when={game().isStalemate}>
            <Show
              when={game().turn === 'w'}
              fallback={<Trans>Black is stalemated.</Trans>}
            >
              <Trans>White is stalemated.</Trans>
            </Show>
          </Match>
          <Match when={game().inCheck}>
            <Show
              when={game().turn === 'w'}
              fallback={<Trans>Black is in check.</Trans>}
            >
              <Trans>White is in check.</Trans>
            </Show>
          </Match>
        </Switch>
      </P>
      {/* Keep the board anchored when a wrong move temporarily disables input. */}
      <div
        class={`box flex-row flex-wrap items-baseline gap-2 ${styles['guidanceRow']}`}
        classList={{ invisible: !props.ctrl.model.interaction().interactive }}
        aria-hidden={!props.ctrl.model.interaction().interactive}
        inert={!props.ctrl.model.interaction().interactive}
      >
        <P variant="caption" tone="secondary">
          <Trans>Tap a piece, then a square.</Trans>
        </P>
        <details class={styles['keyboardHelp']}>
          <summary class="text textCaption list-item cursor-pointer">
            <Trans>Keyboard controls</Trans>
          </summary>
          <P variant="caption" tone="secondary">
            <Trans>Arrows to move, Enter to choose, Escape to cancel.</Trans>
          </P>
        </details>
      </div>
    </>
  );
}
