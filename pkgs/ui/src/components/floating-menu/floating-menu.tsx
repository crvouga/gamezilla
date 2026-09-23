/** @jsxImportSource solid-js */
/**
 * `FloatingMenu` -- anchored popover panel (surface-stack layer + scrim).
 *
 * Content is prop-driven via {@link FloatingMenuContent}. The anchor is a
 * window-space rect (or the trigger element, measured on open) converted to
 * surface-host coordinates with {@link windowRectToHostLocal}. Placement is
 * a static prop (default `bottom-end`); the panel clamps to edges and does
 * not auto-flip.
 *
 * Accessibility: `role="menu"` with `role="menuitem"` rows, focus moves to
 * the first item on open and returns to the trigger on close, arrow keys /
 * Home / End rove between enabled items, Escape (topmost surface only),
 * outside click, and item selection all close the menu.
 */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { OnColorReset, useThemeLayout } from '../../theme';
import { pushEscapeDismissHandler } from '../focus-trap';
import {
  type LayoutRect,
  measureHostFrame,
  windowRectToHostLocal,
} from '../portal-host-frame';
import {
  SurfaceStackSlot,
  useIsTopSurface,
  useSurfaceStackHostFrame,
} from '../surface-stack';
import type {
  FloatingMenuContent,
  FloatingMenuItemRow,
} from './floating-menu-content';
import { estimateFloatingMenuHeight } from './floating-menu-estimate-height';
import { nextMenuItemIndex } from './floating-menu-keyboard';
import {
  FloatingMenuDivider,
  FloatingMenuHeader,
  FloatingMenuItem,
} from './floating-menu-parts';
import {
  computeFloatingMenuPosition,
  type FloatingMenuInsets,
  type FloatingMenuPlacement,
  type FloatingMenuPosition,
} from './floating-menu-position';

export const FLOATING_MENU_DEFAULT_WIDTH = 260;

/** Dispatched by sim layout synthesis when an element's box is installed. */
const ELEMENT_LAYOUT_EVENT = 'ui-testing:element-layout';

const NO_INSETS: FloatingMenuInsets = { top: 0, bottom: 0 };

/** Window-space rect, or the trigger element (measured when the menu opens). */
export type FloatingMenuAnchor = LayoutRect | HTMLElement | null;

export type FloatingMenuProps = {
  open: boolean;
  onClose: () => void;
  anchor: FloatingMenuAnchor;
  /** Static placement. Defaults to `bottom-end`. */
  placement?: FloatingMenuPlacement | undefined;
  /** Safe-area insets to keep clear of. Defaults to none. */
  insets?: FloatingMenuInsets | undefined;
  width?: number | undefined;
  /** Panel body: optional header + rows (items and dividers). */
  content: FloatingMenuContent;
  /** Accessible name for the menu. */
  label?: string | undefined;
  /** Stable surface-stack id. Defaults to a generated unique id. */
  stackId?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function resolveAnchorRect(anchor: FloatingMenuAnchor): LayoutRect | null {
  if (anchor === null) return null;
  return anchor instanceof Element ? measureHostFrame(anchor) : anchor;
}

function menuItems(host: HTMLElement): HTMLElement[] {
  const nodes = host.querySelectorAll<HTMLElement>(
    '[role="menuitem"]:not(:disabled)'
  );
  return Array.from(nodes);
}

/** Focus first item on open, restore the trigger on close, Escape when top. */
function useMenuFocus(
  host: () => HTMLElement | undefined,
  active: () => boolean,
  onClose: () => void
): void {
  createEffect(() => {
    const el = host();
    if (!active() || el === undefined) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    (menuItems(el)[0] ?? el).focus();
    const unsubscribe = pushEscapeDismissHandler(onClose);
    onCleanup(() => {
      unsubscribe();
      previous?.focus();
    });
  });
}

function onMenuKeyDown(host: HTMLElement, ev: KeyboardEvent): void {
  const items = menuItems(host);
  const current =
    document.activeElement instanceof HTMLElement
      ? items.indexOf(document.activeElement)
      : -1;
  const next = nextMenuItemIndex({ key: ev.key, current, count: items.length });
  if (next === null) return;
  ev.preventDefault();
  items[next]?.focus();
}

function FloatingMenuPanel(props: {
  position: FloatingMenuPosition;
  width: number;
  content: FloatingMenuContent;
  label: string | undefined;
  active: boolean;
  onClose: () => void;
}): JSX.Element {
  let hostEl: HTMLElement | undefined;
  useMenuFocus(
    () => hostEl,
    () => props.active,
    () => props.onClose()
  );
  const onSelect = (row: FloatingMenuItemRow): void => {
    row.onClick?.();
    props.onClose();
  };
  return (
    <div
      class="box absolute z-1"
      style={{
        top: `${props.position.top}px`,
        left: `${props.position.left}px`,
        width: `${props.width}px`,
      }}
      {...dataAttrs({ component: 'FloatingMenuPanel' })}
    >
      <OnColorReset>
        <div
          class="box rounded-card border border-border py-2 bg-surface-overlay"
          ref={(el) => {
            hostEl = el;
          }}
          role="menu"
          aria-label={props.label}
          tabIndex={-1}
          onKeyDown={(ev) => onMenuKeyDown(ev.currentTarget, ev)}
        >
          <Show when={props.content.header}>
            {(header) => <FloatingMenuHeader header={header()} />}
          </Show>
          <For each={props.content.rows}>
            {(row) => (
              <Show
                when={row.type === 'item' ? row : undefined}
                fallback={<FloatingMenuDivider />}
              >
                {(item) => (
                  <FloatingMenuItem row={item()} onSelect={onSelect} />
                )}
              </Show>
            )}
          </For>
        </div>
      </OnColorReset>
    </div>
  );
}

export function FloatingMenu(props: FloatingMenuProps): JSX.Element {
  const generatedId = createUniqueId();
  const surfaceId = (): string => props.stackId ?? `menu-${generatedId}`;
  const isTop = useIsTopSurface(surfaceId);
  const hostFrame = useSurfaceStackHostFrame();
  const layout = useThemeLayout();
  // Remeasure when sim layout synthesis updates the trigger box.
  const [layoutEpoch, setLayoutEpoch] = createSignal(0);
  createEffect(() => {
    if (!props.open) return;
    const anchor = props.anchor;
    if (!(anchor instanceof Element)) return;
    const bump = (): void => {
      setLayoutEpoch((n) => n + 1);
    };
    anchor.addEventListener(ELEMENT_LAYOUT_EVENT, bump);
    onCleanup(() => anchor.removeEventListener(ELEMENT_LAYOUT_EVENT, bump));
  });
  // Measure on open (and when layoutEpoch bumps); a menu that outlives its
  // trigger keeps its last spot until the next open.
  const localAnchor = createMemo((): LayoutRect | null => {
    layoutEpoch();
    if (!props.open) return null;
    const rect = resolveAnchorRect(props.anchor);
    return rect === null ? null : windowRectToHostLocal(rect, hostFrame());
  });
  const width = (): number => props.width ?? FLOATING_MENU_DEFAULT_WIDTH;
  const position = (anchor: LayoutRect): FloatingMenuPosition => {
    const host = hostFrame();
    return computeFloatingMenuPosition({
      anchor,
      menuHeight: estimateFloatingMenuHeight(props.content),
      menuWidth: width(),
      insets: props.insets ?? NO_INSETS,
      placement: props.placement ?? 'bottom-end',
      viewport: {
        width: host.width > 0 ? host.width : layout.layout().width,
        height: host.height > 0 ? host.height : layout.layout().height,
      },
    });
  };
  return (
    <Show when={localAnchor()}>
      {(anchor) => (
        <SurfaceStackSlot id={surfaceId()} visible>
          <div
            class="box absolute inset-0 flex-1"
            {...dataAttrs({ component: 'FloatingMenu', ...props.dataSet })}
          >
            <div
              class="box absolute inset-0 bg-scrim"
              data-component="FloatingMenuBackdrop"
              aria-hidden="true"
              onClick={() => props.onClose()}
            />
            <FloatingMenuPanel
              position={position(anchor())}
              width={width()}
              content={props.content}
              label={props.label}
              active={isTop()}
              onClose={props.onClose}
            />
          </div>
        </SurfaceStackSlot>
      )}
    </Show>
  );
}
