import {
  matchesWebShortcut,
  type WebKeyboardEventLike,
} from '../keyboard-shortcuts';
import type { TabStripItem } from './tab-strip-types';

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
  onSelect(items[next]!.id);
}

function closeSelected(
  items: readonly TabStripItem[],
  selectedId: string | null
): void {
  if (selectedId === null) return;
  const item = items.find((i) => i.id === selectedId);
  item?.onClose?.();
}

export function handleTabStripKeyDown(
  ev: WebKeyboardEventLike,
  props: {
    readonly items: readonly TabStripItem[];
    readonly selectedId: string | null;
    readonly onSelect: (id: string) => void;
    readonly onAdd?: () => void;
  }
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
