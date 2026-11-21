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
import { FocusTrap } from '@pkgs/ui-root-client-ts/focus-trap';
import { createScrollTarget } from '@pkgs/ui-root-client-ts/scroll';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createEffect, For, type JSX, onMount, Show } from 'solid-js';

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

/** A named choice panel stays inside even the narrowest board. */
const CELL = 'min(100%, max(37.5%, 144px))';

type StackLayout = {
  readonly style: JSX.CSSProperties;
  readonly kinds: readonly PromotionKind[];
  /** Stacking up from the bottom edge: the cancel chip goes on top. */
  readonly cancelFirst: boolean;
};

/**
 * The named stack anchors to the promotion file and grows away from the
 * board edge. Percentages resolve against the host's
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
      class="clickable clickableTint items-center justify-center text textBodyBold w-full min-h-11"
      style={{
        'background-color': props.theme.promotion.cancel,
        color: props.theme.promotion.ink,
      }}
      type="button"
      aria-label="Cancel promotion"
      data-testid={chessBoardPromotionTestId(props.boardTestId, 'cancel')}
      onClick={() => props.onCancel()}
    >
      <Trans>Cancel</Trans>
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
      class="clickable clickableTint flex-row items-center gap-2 px-2 w-full min-h-11"
      style={{
        'background-color': props.theme.promotion.surface,
        color: 'var(--ui-color-board-card-ink)',
      }}
      type="button"
      aria-label={name()}
      data-testid={chessBoardPromotionTestId(props.boardTestId, props.kind)}
      onClick={() => props.onPick(props.kind)}
    >
      <span
        class={`${styles['piece']} ${styles['promotionPiece']}`}
        data-piece={`${props.color}${props.kind}`}
        aria-hidden="true"
      />
      <span class="text textCaption text-board-card-ink">{name()}</span>
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
  // A board taller than a short landscape view can open its choices below
  // the fold: reveal them at once, so every choice is visible on opening.
  const reveal = createScrollTarget();
  createEffect(() => reveal.scrollIntoView({ behavior: 'instant' }));
  return (
    <div
      class="box absolute flex-col max-h-full overflow-y-auto"
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
      <StackVertical self="stretch" scrollTarget={reveal.target}>
        <h3 class="text textCaption p-2 bg-surface">
          <Trans>Promote pawn</Trans>
        </h3>
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
      </StackVertical>
    </div>
  );
}

export function ChessBoardPromotion(
  props: ChessBoardPromotionProps
): JSX.Element {
  const { t } = useLingui();
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
      <FocusTrap
        active
        autoFocus={false}
        returnFocus={false}
        label={t`Promote pawn`}
      >
        <PromotionStack
          boardTestId={props.boardTestId}
          layout={layout()}
          color={props.color}
          theme={props.theme}
          onPick={props.onPick}
          onCancel={props.onCancel}
        />
      </FocusTrap>
    </div>
  );
}
