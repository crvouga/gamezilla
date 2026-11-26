import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Icon } from '@pkgs/ui-root-client-ts/icon';
import { ChevronRightIcon } from '@pkgs/ui-root-client-ts/icons';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from '@ui-sdk/solid/collapsible';
import { Match, Show, Switch } from 'solid-js';
import type { BoardController } from '../chess-board-controller';
import styles from './chess-board.module.css';

/** Which side sits at the bottom, and whether the side to move is in check. */
function PositionLine(props: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  const game = () => props.ctrl.model.game();
  return (
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
  );
}

/** A disclosure that reads as one: a link-toned label and a turning chevron. */
function KeyboardHelp(): JSX.Element {
  return (
    <Collapsible class={styles['keyboardHelp']}>
      <CollapsibleTrigger
        class={`text textCaption ${styles['keyboardTrigger']}`}
      >
        <span class={styles['keyboardChevron']} aria-hidden="true">
          <Icon icon={ChevronRightIcon} size="sm" tone="inherit" />
        </span>
        <span>
          <Trans>Keyboard controls</Trans>
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel hiddenUntilFound>
        <P variant="caption" tone="secondary">
          <Trans>Arrows to move, Enter to choose, Escape to cancel.</Trans>
        </P>
      </CollapsiblePanel>
    </Collapsible>
  );
}

/** Visible equivalents of board orientation and keyboard/check affordances. */
export function ChessBoardGuidance(props: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  const game = () => props.ctrl.model.game();
  const full = (): boolean => props.props.guidanceDetail !== 'keyboard';
  // Ranks in a gutter at the board's start: the help starts past it, in
  // line with the squares and the seats (`ChessBoardFrame`).
  const gutter = (): boolean =>
    full() &&
    props.props.showCoordinates === true &&
    props.props.coordinatePlacement === 'outside-start';
  return (
    <div
      class={`box gap-ui-xs ${styles['guidance']}`}
      data-gutter={gutter() ? 'start' : undefined}
    >
      <Show when={full()}>
        <PositionLine props={props.props} ctrl={props.ctrl} />
      </Show>
      {/* Keep the board anchored when a wrong move temporarily disables input. */}
      <div
        class={[
          `box flex-row flex-wrap items-baseline gap-2 ${styles['guidanceRow']}`,
          {
            invisible: !props.ctrl.model.interaction().interactive,
            // Under an edge-to-edge board the help keeps the page's inset.
            'px-ui-lg': !full(),
          },
        ]}
        aria-hidden={
          props.ctrl.model.interaction().interactive ? 'false' : 'true'
        }
        inert={!props.ctrl.model.interaction().interactive}
      >
        {/* A finished position takes no move: the row says so in the
            same place, so nothing under the board moves. */}
        <Show
          when={!(game().isCheckmate || game().isStalemate)}
          fallback={
            <Show when={full()}>
              <P variant="caption" tone="secondary">
                <Trans>Final position.</Trans>
              </P>
            </Show>
          }
        >
          <Show when={full()}>
            <P variant="caption" tone="secondary">
              <Trans>Tap a piece, then a square.</Trans>
            </P>
          </Show>
          <KeyboardHelp />
        </Show>
      </div>
    </div>
  );
}
