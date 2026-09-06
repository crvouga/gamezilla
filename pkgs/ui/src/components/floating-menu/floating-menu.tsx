/** @jsxImportSource solid-js */
/**
 * `FloatingMenu` -- anchored popover panel (surface-stack layer + scrim).
 *
 * Content is prop-driven via {@link FloatingMenuContent}. The anchor is a
 * window-space rect (or the trigger element, measured on open) converted to
 * surface-host coordinates with {@link windowRectToHostLocal}; the panel
 * flips above the anchor when space below runs out.
 *
 * Accessibility: `role="menu"` with `role="menuitem"` rows, focus moves to
 * the first item on open and returns to the trigger on close, arrow keys /
 * Home / End rove between enabled items, Escape (topmost surface only),
 * outside click, and item selection all close the menu.
 */

import {
  createEffect,
  createMemo,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { useThemeLayout } from '../../theme';
import { Box } from '../box';
import { pushEscapeDismissHandler } from '../focus-trap';
import { Motion } from '../motion';
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
  type FloatingMenuPosition,
} from './floating-menu-position';

export const FLOATING_MENU_DEFAULT_WIDTH = 260;

const NO_INSETS: FloatingMenuInsets = { top: 0, bottom: 0 };
const ENTER_SX = { opacity: 0, transform: [{ translateY: -4 }] } as const;

/** Window-space rect, or the trigger element (measured when the menu opens). */
export type FloatingMenuAnchor = LayoutRect | HTMLElement | null;

export type FloatingMenuProps = {
  open: boolean;
  onClose: () => void;
  anchor: FloatingMenuAnchor;
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
    <Motion
      duration="fast"
      enterSx={ENTER_SX}
      sx={{
        position: 'absolute',
        top: props.position.top,
        left: props.position.left,
        width: props.width,
      }}
      dataSet={{ component: 'FloatingMenuPanel' }}
    >
      <Box
        ref={(el) => {
          hostEl = el;
        }}
        role="menu"
        aria-label={props.label}
        tabIndex={-1}
        onKeyDown={(ev) => onMenuKeyDown(ev.currentTarget, ev)}
        sx={{
          borderRadius: 'lg',
          borderWidth: 1,
          borderColor: 'border',
          py: 2,
          backgroundColor: 'surfaceOverlay',
          elevation: 3,
        }}
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
              {(item) => <FloatingMenuItem row={item()} onSelect={onSelect} />}
            </Show>
          )}
        </For>
      </Box>
    </Motion>
  );
}

export function FloatingMenu(props: FloatingMenuProps): JSX.Element {
  const generatedId = createUniqueId();
  const surfaceId = (): string => props.stackId ?? `menu-${generatedId}`;
  const isTop = useIsTopSurface(surfaceId);
  const hostFrame = useSurfaceStackHostFrame();
  const layout = useThemeLayout();
  // Measure on open only; a menu that outlives its trigger keeps its spot.
  const localAnchor = createMemo((): LayoutRect | null => {
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
          <Box
            sx={{ absoluteFill: true, flex: 1 }}
            dataSet={{ component: 'FloatingMenu', ...props.dataSet }}
          >
            <Box
              aria-hidden="true"
              onClick={() => props.onClose()}
              sx={{ absoluteFill: true, backgroundColor: 'scrim' }}
              dataSet={{ component: 'FloatingMenuBackdrop' }}
            />
            <FloatingMenuPanel
              position={position(anchor())}
              width={width()}
              content={props.content}
              label={props.label}
              active={isTop()}
              onClose={props.onClose}
            />
          </Box>
        </SurfaceStackSlot>
      )}
    </Show>
  );
}
