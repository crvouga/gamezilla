/**
 * Browser-style tab shortcuts for `TabStrip`: mod+1..9, ctrl+tab /
 * ctrl+shift+tab, mod+alt+arrows, mod+w (close), mod+t (add). Pure.
 */

import type { WebKeyboardEventLike } from '@pkgs/ui-root-shared/match';
import { matchesWebShortcut } from '@pkgs/ui-root-shared/match';
import type { TabStripItem } from './tab-strip-types';

export type TabStripKeyboardProps = {
  readonly items: readonly TabStripItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onAdd?: (() => void) | undefined;
};

function selectByIndex(
  items: readonly TabStripItem[],
  onSelect: (id: string) => void,
  index: number
): void {
  const item = items[index];
  if (item !== undefined) onSelect(item.id);
}

function selectRelative(
  items: readonly TabStripItem[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  delta: number
): void {
  if (items.length === 0) return;
  const cur =
    selectedId === null ? -1 : items.findIndex((i) => i.id === selectedId);
  const next = cur < 0 ? 0 : (cur + delta + items.length * 10) % items.length;
  const item = items[next];
  if (item !== undefined) onSelect(item.id);
}

function closeSelected(
  items: readonly TabStripItem[],
  selectedId: string | null
): void {
  if (selectedId === null) return;
  items.find((i) => i.id === selectedId)?.onClose?.();
}

export function handleTabStripKeyDown(
  ev: WebKeyboardEventLike,
  props: TabStripKeyboardProps
): boolean {
  const { items, selectedId, onSelect, onAdd } = props;
  for (let n = 1; n <= 9; n += 1) {
    if (matchesWebShortcut(`mod+${String(n)}`, ev)) {
      selectByIndex(items, onSelect, n - 1);
      return true;
    }
  }
  if (
    matchesWebShortcut('ctrl+tab', ev) ||
    matchesWebShortcut('mod+alt+arrowright', ev)
  ) {
    selectRelative(items, selectedId, onSelect, 1);
    return true;
  }
  if (
    matchesWebShortcut('ctrl+shift+tab', ev) ||
    matchesWebShortcut('mod+alt+arrowleft', ev)
  ) {
    selectRelative(items, selectedId, onSelect, -1);
    return true;
  }
  if (matchesWebShortcut('mod+w', ev)) {
    closeSelected(items, selectedId);
    return true;
  }
  if (onAdd !== undefined && matchesWebShortcut('mod+t', ev)) {
    onAdd();
    return true;
  }
  return false;
}
