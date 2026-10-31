/** @jsxImportSource solid-js */
/** Promotion picker stacked on the destination file. */

import { Trans, useLingui } from '@lingui/solid/macro';
import { chessBoardPromotionTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type {
  BoardOrientation,
  BoardTheme,
  Move,
  PieceColor,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import { For, type JSX, onMount, Show } from 'solid-js';

import styles from '../chess-board/chess-board.module.css';

type PromotionKind = NonNullable<Move['promotion']>;
const ORDERED: readonly PromotionKind[] = ['q', 'r', 'b', 'n'];

export type ChessBoardPromotionProps = {
  readonly boardTestId: string;
  readonly color: PieceColor;
  readonly to: Square;
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly onPick: (p: PromotionKind) => void;
  readonly onCancel: () => void;
};

/** One square of the painted board, never below a 44px touch target. */
const CELL = 'max(12.5%, 44px)';

type StackLayout = {
  readonly style: JSX.CSSProperties;
  readonly kinds: readonly PromotionKind[];
  /** Stacking up from the bottom edge: the cancel chip goes on top. */
  readonly cancelFirst: boolean;
};

/**
 * The stack sits on the promotion file, the queen on the promotion square,
 * growing away from the board edge. Percentages resolve against the host's
 * content box (the painted board), so no pixel measurement is involved.
 */
function stackLayout(args: {
  to: Square;
  color: PieceColor;
  orientation: BoardOrientation;
}): StackLayout {
  const file = args.to.charCodeAt(0) - 97;
  const rank = args.to.charCodeAt(1) - 49;
  const col = args.orientation === 'white' ? file : 7 - file;
  const row = args.orientation === 'white' ? 7 - rank : rank;
  const fromTop =
    args.orientation === 'white' ? args.color === 'w' : args.color === 'b';
  const left = `clamp(0px, calc(${col} * 12.5% + (12.5% - ${CELL}) / 2), calc(100% - ${CELL}))`;
  const style: JSX.CSSProperties = fromTop
    ? { left, top: `${row * 12.5}%`, width: CELL }
    : { left, bottom: `${(7 - row) * 12.5}%`, width: CELL };
  return {
    style,
    kinds: fromTop ? ORDERED : [...ORDERED].reverse(),
    cancelFirst: !fromTop,
  };
}

function CancelChip(props: {
  readonly boardTestId: string;
  readonly theme: BoardTheme;
  readonly onCancel: () => void;
}): JSX.Element {
  return (
    <button
      class="clickable clickableTint items-center justify-center text textBodyBold w-full"
      style={{
        'background-color': props.theme.promotion.cancel,
        color: props.theme.promotion.ink,
        'aspect-ratio': '1 / 0.45',
      }}
      type="button"
      aria-label="Cancel promotion"
      data-testid={chessBoardPromotionTestId(props.boardTestId, 'cancel')}
      onClick={() => props.onCancel()}
    >
      <Trans>✕</Trans>
    </button>
  );
}

function PromotionChoice(props: {
  readonly boardTestId: string;
  readonly kind: PromotionKind;
  readonly color: PieceColor;
  readonly theme: BoardTheme;
  readonly onPick: (p: PromotionKind) => void;
}): JSX.Element {
  const { t } = useLingui();
  let button: HTMLButtonElement | undefined;
  onMount(() => {
    if (props.kind === 'q') button?.focus();
  });
  const name = () =>
    ({ q: t`Queen`, r: t`Rook`, b: t`Bishop`, n: t`Knight` })[props.kind];
  return (
    <button
      ref={button}
      class="clickable clickableTint p-0 w-full aspect-square"
      style={{ 'background-color': props.theme.promotion.surface }}
      type="button"
      aria-label={name()}
      data-testid={chessBoardPromotionTestId(props.boardTestId, props.kind)}
      onClick={() => props.onPick(props.kind)}
    >
      <span
        class={`${styles['piece']} ${styles['promotionPiece']}`}
        data-piece={`${props.color}${props.kind}`}
      />
    </button>
  );
}

function PromotionStack(props: {
  readonly boardTestId: string;
  readonly layout: StackLayout;
  readonly color: PieceColor;
  readonly theme: BoardTheme;
  readonly onPick: (p: PromotionKind) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const cancel = () => (
    <CancelChip
      boardTestId={props.boardTestId}
      theme={props.theme}
      onCancel={props.onCancel}
    />
  );
  return (
    <div
      class="box absolute flex-col"
      role="presentation"
      style={props.layout.style}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          props.onCancel();
        }
      }}
    >
      <Show when={props.layout.cancelFirst}>{cancel()}</Show>
      <For each={[...props.layout.kinds]}>
        {(kind) => (
          <PromotionChoice
            boardTestId={props.boardTestId}
            kind={kind}
            color={props.color}
            theme={props.theme}
            onPick={props.onPick}
          />
        )}
      </For>
      <Show when={!props.layout.cancelFirst}>{cancel()}</Show>
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
    });
  return (
    <div
      class={`box absolute inset-0 ${styles['promotion']}`}
      style={{ 'background-color': props.theme.promotion.backdrop }}
      data-component="ChessBoardPromotion"
      role="presentation"
      // The picker is modal: board gestures under it must not start a drag,
      // select a square or capture the pointer away from these buttons. The
      // board listens natively on its host, so these must be native too
      // (delegated handlers would run after the host's).
      on:pointerdown={(e) => e.stopPropagation()}
      on:contextmenu={(e) => e.preventDefault()}
      onClick={() => props.onCancel()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          props.onCancel();
        }
      }}
    >
      <PromotionStack
        boardTestId={props.boardTestId}
        layout={layout()}
        color={props.color}
        theme={props.theme}
        onPick={props.onPick}
        onCancel={props.onCancel}
      />
    </div>
  );
}
