import type { BugReportSubject } from '@pkgs/feedback-shared-ts/types';
import type {
  ContextMenuGroup,
  ContextMenuPoint,
} from '@pkgs/ui-root-client-ts/context-menu';
import { contextMenuGroups } from './context-menu-items';
import { describeSubject, readMenuTarget } from './context-menu-target';
import type { BrowserPort } from './ports';

export type ContextMenuState = {
  readonly open: boolean;
  readonly at: ContextMenuPoint | null;
  readonly groups: readonly ContextMenuGroup[];
  readonly notice?: string | undefined;
};

export type ContextMenuControl = {
  state(): ContextMenuState;
  subscribe(listener: () => void): () => void;
  close(): void;
  dispose(): void;
};

const CLOSED: ContextMenuState = { open: false, at: null, groups: [] };

function pointerTypeOf(event: Event): string | null {
  const type = (event as Partial<PointerEvent>).pointerType;
  return typeof type === 'string' && type !== '' ? type : null;
}

function asksForMenu(event: KeyboardEvent): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
}

/** Where a menu the keyboard asked for opens: under the focused thing, inside the window. */
function underFocus(element: Element): ContextMenuPoint {
  const box = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  const height = view?.innerHeight ?? box.bottom;
  return {
    x: Math.max(0, box.left),
    y: Math.min(Math.max(0, box.bottom), height),
  };
}

/**
 * The app's own right-click menu on a computer: what the browser's menu
 * does that a page may do, and "Report a bug about this".
 *
 * Only a mouse opens it, and the ContextMenu key or Shift+F10 at the
 * focused thing; a finger or a pen keeps whatever a long press does. The
 * browser's own menu stays one step away: Shift+right-click, a second
 * right-click while this one is open, a page that handled the right-click
 * itself (`preventDefault`), and anything inside `data-native-context-menu`
 * all get it.
 */
export function installContextMenu(options: {
  readonly document: Document;
  readonly browser: BrowserPort;
  readonly onReport: (subject: BugReportSubject) => void;
}): ContextMenuControl {
  const { document, browser } = options;
  const listeners = new Set<() => void>();
  let current = CLOSED;
  let lastPointer: string | null = null;
  /** The keyboard opened the menu; the browser may still raise its own for that key. */
  let keyboardOpened = false;

  function set(next: ContextMenuState): void {
    current = next;
    for (const listener of listeners) listener();
  }
  function close(): void {
    if (current.open) set({ ...current, open: false, notice: undefined });
  }
  function show(
    element: Element,
    at: ContextMenuPoint,
    pointer: ContextMenuPoint | null
  ): boolean {
    const target = readMenuTarget(element);
    if (!target) return false;
    // Named as it is now, before choosing an item can move the focus or the selection.
    const subject = describeSubject(target, pointer);
    const groups = contextMenuGroups(target, {
      browser,
      report: () => options.onReport(subject),
      refused: (notice) => set({ open: true, at, groups, notice }),
    });
    set({ open: true, at, groups });
    return true;
  }

  const onPointerDown = (event: Event): void => {
    lastPointer = pointerTypeOf(event);
    keyboardOpened = false;
  };
  const onContextMenu = (event: Event): void => {
    const menu = event as MouseEvent;
    if (keyboardOpened) {
      keyboardOpened = false;
      if (current.open) menu.preventDefault();
      return;
    }
    if (menu.defaultPrevented) return;
    // A second right-click while ours is open gets the browser's own.
    if (current.open) {
      close();
      return;
    }
    if (menu.shiftKey) return;
    if ((pointerTypeOf(menu) ?? lastPointer) !== 'mouse') return;
    if (!(menu.target instanceof Element)) return;
    const at = { x: menu.clientX, y: menu.clientY };
    if (show(menu.target, at, at)) menu.preventDefault();
  };
  const onKeyDown = (event: Event): void => {
    const key = event as KeyboardEvent;
    if (key.defaultPrevented || !asksForMenu(key) || current.open) return;
    const focused = document.activeElement ?? document.body;
    if (show(focused, underFocus(focused), null)) {
      key.preventDefault();
      keyboardOpened = true;
    }
  };
  const view = document.defaultView;
  const bindings: [EventTarget | null, string, EventListener, boolean][] = [
    [document, 'pointerdown', onPointerDown, true],
    [document, 'contextmenu', onContextMenu, false],
    [document, 'keydown', onKeyDown, false],
    // The page moved from under the menu: what it pointed at is somewhere else now.
    [document, 'scroll', close, true],
    [view, 'resize', close, false],
    [view, 'blur', close, false],
  ];
  for (const [target, type, listener, capture] of bindings)
    target?.addEventListener(type, listener, capture);
  return {
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close,
    dispose(): void {
      for (const [target, type, listener, capture] of bindings)
        target?.removeEventListener(type, listener, capture);
      listeners.clear();
    },
  };
}
