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
import { Box } from '@pkgs/ui';
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
  const { ctrl } = args;
  const pending = () => ctrl.model.interaction().pendingPromotion;
  return (
    <>
      <Show when={pending()}>
        {(p) => (
          <ChessBoardPromotion
            color={p().color}
            to={p().to}
            orientation={ctrl.orientation()}
            theme={ctrl.theme()}
            boardPx={ctrl.boardPx() || BOARD_UNITS}
            onPick={(promo) => {
              ctrl.model.actions.pickPromotion(promo);
              ctrl.model.markSnap(p().to);
            }}
            onCancel={() => ctrl.model.actions.cancelPromotion()}
          />
        )}
      </Show>
      <Box
        class={styles['probe']}
        dataSet={{ testid: chessBoardProbeTestId(args.boardTestId()) }}
        aria-hidden="true"
      >
        {JSON.stringify(
          buildChessBoardProbe({
            fen: ctrl.model.game().fen,
            size: ctrl.boardPx() || args.size || 0,
            orientation: ctrl.orientation(),
          })
        )}
      </Box>
    </>
  );
}

export type HostTheme = BoardTheme;
export type HostOrientation = BoardOrientation;
