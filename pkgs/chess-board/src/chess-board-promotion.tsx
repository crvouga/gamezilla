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
import { Box, Clickable } from '@pkgs/ui';
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
  const cell = args.boardPx / 8;
  const file = args.to.charCodeAt(0) - 97;
  const rank = args.to.charCodeAt(1) - 49;
  const col = args.orientation === 'white' ? file : 7 - file;
  const row = args.orientation === 'white' ? 7 - rank : rank;
  const fromTop =
    args.orientation === 'white' ? args.color === 'w' : args.color === 'b';
  return {
    left: col * cell,
    top: fromTop ? row * cell : Math.max(0, row * cell - cell * 3),
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
    <Box
      sx={{
        position: 'absolute',
        left: props.layout.left,
        top: props.layout.top,
        width: props.layout.cell,
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <For each={[...props.layout.kinds]}>
        {(kind) => (
          <Clickable
            aria-label={kind}
            onClick={() => props.onPick(kind)}
            sx={{
              width: props.layout.cell,
              height: props.layout.cell,
              p: 0,
              backgroundColor: props.theme.promotion.surface,
            }}
          >
            <img
              src={pieceImageUri(props.color, kind)}
              alt=""
              width={props.layout.cell}
              height={props.layout.cell}
              draggable={false}
            />
          </Clickable>
        )}
      </For>
      <Clickable
        aria-label="Cancel promotion"
        onClick={() => props.onCancel()}
        sx={{
          width: props.layout.cell,
          height: props.layout.cell * 0.45,
          backgroundColor: props.theme.promotion.cancel,
          color: props.theme.promotion.ink,
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
      >
        <Trans>✕</Trans>
      </Clickable>
    </Box>
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
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundColor: props.theme.promotion.backdrop,
      }}
      onClick={() => props.onCancel()}
      dataSet={{ component: 'ChessBoardPromotion' }}
    >
      <PromotionStack
        layout={layout()}
        color={props.color}
        theme={props.theme}
        onPick={props.onPick}
        onCancel={props.onCancel}
      />
    </Box>
  );
}
