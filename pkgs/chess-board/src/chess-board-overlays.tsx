/** @jsxImportSource solid-js */
/**
 * Promotion overlay + E2E probe for {@link ChessBoardView}. The probe (a
 * chess.js parse + JSON of the whole board state) exists only in dev / E2E
 * builds, so production pays nothing for it.
 */

import {
  buildChessBoardProbe,
  type ChessBoardProbeInteraction,
  chessBoardProbeTestId,
} from '@pkgs/chess-board-core/probe';
import { COMPONENT_IDS_ENABLED } from '@pkgs/ui';
import type { Accessor, JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';

import styles from './chess-board.module.css';
import type { BoardController } from './chess-board-controller';
import { ChessBoardPromotion } from './chess-board-promotion';

function probeInteraction(ctrl: BoardController): ChessBoardProbeInteraction {
  const ix = ctrl.model.interaction();
  const lastMove = ctrl.model.game().lastMove;
  const pending = ix.pendingPromotion;
  return {
    interactive: ix.interactive,
    selected: ix.selected,
    legalTargets: ix.legalTargets,
    lastMove:
      lastMove === null ? null : { from: lastMove.from, to: lastMove.to },
    promotion:
      pending === null
        ? null
        : { from: pending.from, to: pending.to, color: pending.color },
    premoves: ix.premves.map((p) => ({ from: p.from, to: p.to })),
    cursor: ctrl.cursor(),
  };
}

function ChessBoardProbe(args: {
  readonly ctrl: BoardController;
  readonly boardTestId: Accessor<string>;
  readonly size: number | undefined;
}): JSX.Element {
  const probeJson = createMemo(() =>
    JSON.stringify(
      buildChessBoardProbe({
        fen: args.ctrl.model.game().fen,
        size: (args.ctrl.boardPx() || args.size) ?? 0,
        orientation: args.ctrl.orientation(),
        interaction: probeInteraction(args.ctrl),
      })
    )
  );
  return (
    <div
      class={`box ${styles['probe']}`}
      data-testid={chessBoardProbeTestId(args.boardTestId())}
      aria-hidden="true"
    >
      {probeJson()}
    </div>
  );
}

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
            boardTestId={args.boardTestId()}
            color={p().color}
            to={p().to}
            orientation={args.ctrl.orientation()}
            theme={args.ctrl.theme()}
            onPick={(promo) => args.ctrl.model.actions.pickPromotion(promo)}
            onCancel={() => args.ctrl.model.actions.cancelPromotion()}
          />
        )}
      </Show>
      <Show when={COMPONENT_IDS_ENABLED}>
        <ChessBoardProbe
          ctrl={args.ctrl}
          boardTestId={args.boardTestId}
          size={args.size}
        />
      </Show>
    </>
  );
}
