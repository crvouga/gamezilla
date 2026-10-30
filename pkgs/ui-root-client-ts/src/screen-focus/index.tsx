/** @jsxImportSource solid-js */

import { sequentialFocusOrder } from '@pkgs/a11y-shared-ts/focus';
import {
  createContext,
  type JSX,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js';

type LiveScreen = { readonly root: HTMLElement; readonly id: () => string };

type ScreenFocusMemory = {
  /** Per screen id: the index, in its focus order, of the control last focused. */
  readonly places: Map<string, number>;
  /** Screens on the page, oldest first. */
  readonly live: LiveScreen[];
  /** A screen went away with the keyboard in the app; the next one may take it. */
  pending: boolean;
};

const ScreenFocusContext = createContext<ScreenFocusMemory>();

/**
 * Where the keyboard goes when one screen replaces another (WCAG 2.4.3 Focus
 * Order). When a navigation takes away the element the keyboard was on, the
 * keyboard would drop to the start of the page; instead the screen that
 * replaced it takes the keyboard — back on the control the person left it
 * from when they return to a screen, else on the screen's title. The first
 * screen of the app, and a screen shown while the keyboard stays put (a tab
 * switch leaves it on the tab), leave the keyboard alone.
 *
 * {@link ScreenFocusProvider} (mounted by `AppFrame`) holds what each screen
 * remembers; without it `ScreenBase` manages no focus.
 */
export function ScreenFocusProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const memory: ScreenFocusMemory = {
    places: new Map(),
    live: [],
    pending: false,
  };
  return (
    <ScreenFocusContext.Provider value={memory}>
      {props.children}
    </ScreenFocusContext.Provider>
  );
}

function keyboardLost(document: Document): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || !active.isConnected;
}

/**
 * The screen's title (else the screen), made focusable by script only. It is
 * a place to read from, not a control, so `screenFocusTarget` draws no ring.
 */
function titleOf(root: HTMLElement): HTMLElement {
  const title = root.querySelector<HTMLElement>('h1') ?? root;
  if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1');
  title.classList.add('screenFocusTarget');
  return title;
}

/**
 * Once the screen that replaced the departed one is on the page: if the
 * keyboard was dropped, it goes to that screen's remembered control or title.
 */
function handOver(memory: ScreenFocusMemory): void {
  if (!memory.pending) return;
  const screen = memory.live.findLast((live) => live.root.isConnected);
  if (screen === undefined) return;
  memory.pending = false;
  if (!keyboardLost(screen.root.ownerDocument)) return;
  const index = memory.places.get(screen.id());
  const place =
    index === undefined ? undefined : sequentialFocusOrder(screen.root)[index];
  const target = (place as HTMLElement | undefined) ?? titleOf(screen.root);
  target.focus({ preventScroll: true });
}

type Tracked = {
  /** Index, in the screen's focus order, of the control focused last. */
  last: number | undefined;
  /**
   * The keyboard is in the screen: focus entered it and has not moved to
   * another element since (dropping to nothing, as when the focused control
   * goes away, still counts as the screen's).
   */
  holding: boolean;
};

/** Follow the keyboard in and out of `root`; returns the detacher. */
function trackKeyboard(root: HTMLElement, tracked: Tracked): () => void {
  const onFocusIn = (event: FocusEvent): void => {
    tracked.holding = true;
    const index = sequentialFocusOrder(root).indexOf(event.target as Element);
    if (index >= 0) tracked.last = index;
  };
  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next !== null && !root.contains(next)) tracked.holding = false;
  };
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  return () => {
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
  };
}

/**
 * Remember the control the keyboard was last on inside `root`, and hand the
 * keyboard to the next screen when this one goes away with it.
 */
export function useScreenFocus(
  root: () => HTMLElement | undefined,
  screenId: () => string
): void {
  const memory = useContext(ScreenFocusContext);
  if (memory === undefined) return;
  onMount(() => {
    const element = root();
    if (element === undefined) return;
    const tracked: Tracked = { last: undefined, holding: false };
    const detach = trackKeyboard(element, tracked);
    const screen: LiveScreen = { root: element, id: screenId };
    memory.live.push(screen);
    onCleanup(() => {
      detach();
      memory.live.splice(memory.live.indexOf(screen), 1);
      if (tracked.last === undefined) memory.places.delete(screenId());
      else memory.places.set(screenId(), tracked.last);
      const inApp = !keyboardLost(element.ownerDocument);
      if (!tracked.holding && !inApp) return;
      memory.pending = true;
      // After the navigation has swapped the screens and closed its menus.
      queueMicrotask(() => handOver(memory));
    });
    queueMicrotask(() => handOver(memory));
  });
}
