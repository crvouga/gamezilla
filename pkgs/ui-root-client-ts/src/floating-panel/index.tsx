/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';

/** `auto` wraps the content; `window` is a fixed-size window. */
export type FloatingPanelSize = 'auto' | 'window';

/** A dragged position, from the panel's resting corner. */
export type FloatingPanelOffset = { readonly x: number; readonly y: number };

/** Pointer and keyboard handlers of the drag handle. */
export type FloatingPanelDrag = {
  readonly down: (event: PointerEvent) => void;
  readonly move: (event: PointerEvent) => void;
  readonly up: (event: PointerEvent) => void;
  readonly key: (event: KeyboardEvent) => void;
};

export type FloatingPanelProps = {
  /** Accessible name of the panel. */
  label: string;
  children?: JSX.Element | undefined;
  /** Default `auto`. */
  size?: FloatingPanelSize | undefined;
  /** `dialog` (default) for a window, `region` for a standing control. */
  role?: 'dialog' | 'region' | undefined;
  /** Title row of a `window` (a `FloatingPanelHeader`). */
  header?: JSX.Element | undefined;
  offset?: FloatingPanelOffset | undefined;
  /** Height cap in px (the room the viewport leaves). */
  maxHeight?: number | undefined;
  /** The panel element (focus the first field, listen for Escape). */
  panelRef?: ((element: HTMLElement) => void) | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const SIZE: Readonly<Record<FloatingPanelSize, string>> = {
  auto: 'p-ui-md gap-ui-sm',
  window: 'w-128 h-160 max-w-full',
};

function panelStyle(panel: FloatingPanelProps): JSX.CSSProperties {
  return {
    ...(panel.offset === undefined
      ? {}
      : { transform: `translate(${panel.offset.x}px, ${panel.offset.y}px)` }),
    ...(panel.maxHeight === undefined
      ? {}
      : { 'max-height': `${Math.max(0, panel.maxHeight)}px` }),
  };
}

/**
 * `FloatingPanel` -- a small window that floats over the page at its
 * bottom-end corner and leaves the page usable: nothing is dimmed, focus is
 * not trapped (`role="dialog"` with `aria-modal="false"`). A feedback
 * composer, a recording control, a chat that stays open while the person
 * keeps working. For a task that blocks the page use `ResponsiveSurface`;
 * for a panel anchored to a control use `Popover`.
 *
 * - `size="window"` is a fixed 512 × 640 window (never wider than the
 *   viewport) with a `FloatingPanelHeader` above a body that fills the rest;
 *   `size="auto"` (default) wraps its content in a padded stack.
 * - `offset` moves the panel from its corner (a dragged position, in px,
 *   negative is up / toward the start); `maxHeight` caps it to the room the
 *   viewport has. Both are runtime values the caller measures.
 * - `FloatingPanelHeader` is the title row: the title is the drag handle
 *   (pointer and arrow keys, through `drag`), `trailing` holds the close
 *   button.
 *
 * Visual: the surface fill, a hairline border, the sheet radius and the one
 * float shadow.
 *
 * @example
 * ```tsx
 * <FloatingPanel
 *   label={t`Feedback`}
 *   size="window"
 *   offset={position()}
 *   header={
 *     <FloatingPanelHeader
 *       title={t`Feedback`}
 *       handleLabel={t`Move feedback; use arrow keys`}
 *       drag={drag}
 *       trailing={<CloseIconButton onClick={close} />}
 *     />
 *   }
 * >
 *   <FeedbackPanel />
 * </FloatingPanel>
 * ```
 */
export function FloatingPanel(props: FloatingPanelProps): JSX.Element {
  const size = (): FloatingPanelSize => props.size ?? 'auto';
  return (
    <section
      ref={(element) => props.panelRef?.(element)}
      role={props.role === 'region' ? 'region' : 'dialog'}
      aria-modal={props.role === 'region' ? undefined : 'false'}
      aria-label={props.label}
      class={`box fixed right-4 bottom-4 rounded-sheet border border-border bg-surface shadow-float pointer-events-auto overflow-hidden ${SIZE[size()]}`}
      style={panelStyle(props)}
      data-testid={props.testId}
      data-component={componentId('FloatingPanel')}
    >
      <Show when={size() === 'window'} fallback={props.children}>
        {props.header}
        <div class="box flex-1 min-h-0 shrink overflow-hidden">
          {props.children}
        </div>
      </Show>
    </section>
  );
}

export type FloatingPanelHeaderProps = {
  title: JSX.Element;
  /** Accessible name of the drag handle (say how to move it by keyboard). */
  handleLabel: string;
  /** Unset makes the title a plain heading row. */
  drag?: FloatingPanelDrag | undefined;
  /** End of the row: the close button. */
  trailing?: JSX.Element | undefined;
  /** Rendered as `data-testid` on the drag handle. */
  handleTestId?: string | undefined;
};

export function FloatingPanelHeader(
  props: FloatingPanelHeaderProps
): JSX.Element {
  return (
    <div
      class="box flex-row items-center gap-ui-sm border-b border-border px-ui-lg py-ui-md"
      data-component={componentId('FloatingPanelHeader')}
    >
      <button
        type="button"
        class="text textBodyBold flex-1 min-w-0 text-start cursor-grab touch-none inline-flex items-center gap-ui-sm"
        aria-label={props.handleLabel}
        onPointerDown={(event) => props.drag?.down(event)}
        onPointerMove={(event) => props.drag?.move(event)}
        onPointerUp={(event) => props.drag?.up(event)}
        onPointerCancel={(event) => props.drag?.up(event)}
        onKeyDown={(event) => props.drag?.key(event)}
        data-testid={props.handleTestId}
        data-component={componentId('FloatingPanelHandle')}
      >
        <span class="text-tint" aria-hidden="true">
          {'⠿'}
        </span>
        {props.title}
      </button>
      {props.trailing}
    </div>
  );
}
