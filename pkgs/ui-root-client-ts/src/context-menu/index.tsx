/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX, Show } from 'solid-js';
import { CommandPaletteKbd } from '../command-palette-kbd/index';
import type { IconComponent } from '../create-icon/index';
import { FloatingMenu } from '../floating-menu/index';
import type {
  FloatingMenuContent,
  FloatingMenuContentRow,
} from '../floating-menu-content';

/** Wide enough for "Search the web for" and a short quote on one line. */
export const CONTEXT_MENU_WIDTH = 340;

export type ContextMenuItem = {
  /** Stable key; the row's `data-testid` is `context-menu-<id>`. */
  readonly id: string;
  readonly label: string;
  readonly icon: IconComponent;
  /** A shortcut spec (`mod+shift+b`) shown as key caps on the trailing edge. */
  readonly shortcut?: string | undefined;
  readonly disabled?: boolean | undefined;
  /** Runs once the menu has closed and focus is back where it was. */
  readonly onSelect: () => void;
};

/** Items that belong together; a divider separates one group from the next. */
export type ContextMenuGroup = {
  readonly id: string;
  readonly items: readonly ContextMenuItem[];
};

/** A window-space point, in CSS px. */
export type ContextMenuPoint = {
  readonly x: number;
  readonly y: number;
};

export type ContextMenuProps = {
  open: boolean;
  /** Where the menu opens from: the pointer, or a corner of the focused element. */
  at: ContextMenuPoint | null;
  groups: readonly ContextMenuGroup[];
  /** Accessible name of the menu. */
  label: string;
  /** One plain sentence under the items, said aloud as it appears. */
  notice?: string | undefined;
  onClose: () => void;
  dataSet?: ComponentDataSet | undefined;
};

function rowsOf(
  groups: readonly ContextMenuGroup[],
  onClose: () => void
): FloatingMenuContentRow[] {
  const rows: FloatingMenuContentRow[] = [];
  for (const group of groups) {
    if (group.items.length === 0) continue;
    if (rows.length > 0) rows.push({ type: 'divider', id: `${group.id}-gap` });
    for (const item of group.items)
      rows.push({
        type: 'item',
        id: item.id,
        label: item.label,
        icon: item.icon,
        disabled: item.disabled,
        trailing:
          item.shortcut === undefined ? undefined : (
            <CommandPaletteKbd shortcut={item.shortcut} />
          ),
        dataSet: { testid: `context-menu-${item.id}` },
        // Close first, so focus is back on what the person pointed at
        // (a field keeps its selection) before the item acts on it.
        onClick: () => {
          onClose();
          item.onSelect();
        },
      });
  }
  return rows;
}

/**
 * `ContextMenu` -- the menu a right-click (or the ContextMenu key, or
 * Shift+F10) opens at a point, listing what can be done with the thing
 * under it.
 *
 * Built on {@link FloatingMenu}: the same panel, rows, dividers and
 * keyboard (arrows, Home / End, Enter, Escape), focus moves to the first
 * item on open and returns to where it was on close. It opens below and to
 * the right of the point, flipping above when it does not fit, and clamps
 * inside the window. Groups are separated by a divider; an empty group
 * shows nothing. A `notice` shows under the items, for an item that could
 * not do what it offered; a status region that outlives the menu says it
 * aloud.
 */
export function ContextMenu(props: ContextMenuProps): JSX.Element {
  const content = createMemo(
    (): FloatingMenuContent => ({
      rows: rowsOf(props.groups, () => props.onClose()),
    })
  );
  return (
    <>
      <p class="sr-only" role="status">
        {props.open ? (props.notice ?? '') : ''}
      </p>
      <Show when={props.at} keyed>
        {(at) => (
          <FloatingMenu
            open={props.open}
            onClose={() => props.onClose()}
            anchor={{ x: at.x, y: at.y, width: 0, height: 0 }}
            placement="bottom-start"
            width={CONTEXT_MENU_WIDTH}
            content={content()}
            label={props.label}
            notice={props.notice}
            dataSet={{ component: 'ContextMenu', ...props.dataSet }}
          />
        )}
      </Show>
    </>
  );
}
