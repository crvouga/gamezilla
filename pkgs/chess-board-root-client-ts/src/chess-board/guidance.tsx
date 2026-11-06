import { Trans } from '@lingui/solid/macro';
import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { BoardController } from '../chess-board-controller';

/** Visible equivalents of board orientation and keyboard/check affordances. */
export function ChessBoardGuidance(props: {
  readonly props: ChessBoardProps;
  readonly ctrl: BoardController;
}): JSX.Element {
  return (
    <>
      <P variant="caption">
        <Show
          when={props.props.orientation === 'black'}
          fallback={<Trans>White pieces nearest you.</Trans>}
        >
          <Trans>Black pieces nearest you.</Trans>
        </Show>{' '}
        <Show when={props.ctrl.model.game().inCheck}>
          <Show
            when={props.ctrl.model.game().turn === 'w'}
            fallback={<Trans>Black is in check.</Trans>}
          >
            <Trans>White is in check.</Trans>
          </Show>
        </Show>
      </P>
      <Show when={props.props.interactive !== false}>
        <P variant="caption" tone="secondary">
          <Trans>
            Tap a piece, then its destination. Keyboard: arrows to move, Enter
            to choose, Escape to cancel.
          </Trans>
        </P>
      </Show>
    </>
  );
}
