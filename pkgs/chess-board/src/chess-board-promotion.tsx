/** @jsxImportSource solid-js */
/** Promotion picker stacked on the destination file. */

import { Trans } from '@lingui/solid/macro';
import type {
  BoardOrientation,
  BoardTheme,
  Move,
  PieceColor,
  Square,
} from '@pkgs/chess-board-core/types';
import { For, type JSX } from 'solid-js';

import { pieceImageUri } from './piece-images';

type PromotionKind = NonNullable<Move['promotion']>;
const ORDERED: readonly PromotionKind[] = ['q', 'r', 'b', 'n'];

export type ChessBoardPromotionProps = {
  readonly color: PieceColor;
  readonly to: Square;
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly boardPx: number;
  readonly onPick: (p: PromotionKind) => void;
  readonly onCancel: () => void;
};

function stackLayout(args: {
  to: Square;
  color: PieceColor;
  orientation: BoardOrientation;
  boardPx: number;
}): {
  left: number;
  top: number;
  cell: number;
  kinds: readonly PromotionKind[];
} {
  const fileCell = args.boardPx / 8;
  const cell = Math.max(fileCell, 44);
  const file = args.to.charCodeAt(0) - 97;
  const rank = args.to.charCodeAt(1) - 49;
  const col = args.orientation === 'white' ? file : 7 - file;
  const row = args.orientation === 'white' ? 7 - rank : rank;
  const fromTop =
    args.orientation === 'white' ? args.color === 'w' : args.color === 'b';
  return {
    left: col * fileCell + (fileCell - cell) / 2,
    top: fromTop ? row * fileCell : Math.max(0, row * fileCell - cell * 3),
    cell,
    kinds: fromTop ? ORDERED : [...ORDERED].reverse(),
  };
}

function PromotionStack(props: {
  readonly layout: ReturnType<typeof stackLayout>;
  readonly color: PieceColor;
  readonly theme: BoardTheme;
  readonly onPick: (p: PromotionKind) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <div
      class="box absolute flex-col"
      role="presentation"
      style={{
        left: `${props.layout.left}px`,
        top: `${props.layout.top}px`,
        width: `${props.layout.cell}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onCancel();
      }}
    >
      <For each={[...props.layout.kinds]}>
        {(kind) => (
          <button
            class="clickable clickableTint p-0"
            style={{
              'background-color': props.theme.promotion.surface,
              width: `${props.layout.cell}px`,
              height: `${props.layout.cell}px`,
            }}
            type="button"
            aria-label={kind}
            onClick={() => props.onPick(kind)}
          >
            <img
              src={pieceImageUri(props.color, kind)}
              alt=""
              width={props.layout.cell}
              height={props.layout.cell}
              draggable={false}
            />
          </button>
        )}
      </For>
      <button
        class="clickable clickableTint items-center justify-center font-bold"
        style={{
          'background-color': props.theme.promotion.cancel,
          color: props.theme.promotion.ink,
          width: `${props.layout.cell}px`,
          height: `${props.layout.cell * 0.45}px`,
        }}
        type="button"
        aria-label="Cancel promotion"
        onClick={() => props.onCancel()}
      >
        <Trans>✕</Trans>
      </button>
    </div>
  );
}

export function ChessBoardPromotion(
  props: ChessBoardPromotionProps
): JSX.Element {
  const layout = () =>
    stackLayout({
      to: props.to,
      color: props.color,
      orientation: props.orientation,
      boardPx: props.boardPx,
    });
  return (
    <div
      class="box absolute inset-[0]"
      style={{ 'background-color': props.theme.promotion.backdrop }}
      data-component="ChessBoardPromotion"
      role="presentation"
      onClick={() => props.onCancel()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onCancel();
      }}
    >
      <PromotionStack
        layout={layout()}
        color={props.color}
        theme={props.theme}
        onPick={props.onPick}
        onCancel={props.onCancel}
      />
    </div>
  );
}
