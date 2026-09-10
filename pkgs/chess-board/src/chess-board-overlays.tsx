/** @jsxImportSource solid-js */
/**
 * Promotion overlay + E2E probe for {@link ChessBoardView}.
 */

import {
  buildChessBoardProbe,
  chessBoardProbeTestId,
} from '@pkgs/chess-board-core/probe';
import type {
  BoardOrientation,
  BoardTheme,
} from '@pkgs/chess-board-core/types';
import type { Accessor, JSX } from 'solid-js';
import { Show } from 'solid-js';

import { BOARD_UNITS } from './board-units';
import styles from './chess-board.module.css';
import type { BoardController } from './chess-board-controller';
import { ChessBoardPromotion } from './chess-board-promotion';

export function ChessBoardOverlays(args: {
  readonly ctrl: BoardController;
  readonly boardTestId: Accessor<string>;
  readonly size: number | undefined;
}): JSX.Element {
  const pending = () => args.ctrl.model.interaction().pendingPromotion;
  return (
    <>
      <Show when={pending()}>
        {(p) => (
          <ChessBoardPromotion
            color={p().color}
            to={p().to}
            orientation={args.ctrl.orientation()}
            theme={args.ctrl.theme()}
            boardPx={args.ctrl.boardPx() || BOARD_UNITS}
            onPick={(promo) => {
              args.ctrl.model.actions.pickPromotion(promo);
              args.ctrl.model.markSnap(p().to);
            }}
            onCancel={() => args.ctrl.model.actions.cancelPromotion()}
          />
        )}
      </Show>
      <div
        class={`box ${styles['probe']}`}
        data-testid={chessBoardProbeTestId(args.boardTestId())}
        aria-hidden="true"
      >
        {JSON.stringify(
          buildChessBoardProbe({
            fen: args.ctrl.model.game().fen,
            size: (args.ctrl.boardPx() || args.size) ?? 0,
            orientation: args.ctrl.orientation(),
          })
        )}
      </div>
    </>
  );
}

export type HostTheme = BoardTheme;
export type HostOrientation = BoardOrientation;
