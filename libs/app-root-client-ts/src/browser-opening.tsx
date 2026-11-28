/** @jsxImportSource @solidjs/web */

import type { ThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { JSX } from '@solidjs/web';
import {
  createContext,
  onCleanup,
  onSettled,
  untrack,
  useContext,
} from 'solid-js';

import { finishOpeningGesture } from './finish-opening-gesture';
import { restoreOpeningSearch } from './restore-opening-search';

type Opening = {
  readonly ready: () => void | (() => void);
  readonly quietActivity: () => boolean;
  readonly bindTheme: (setPreference: (value: ThemePreference) => void) => void;
};

const OpeningContext = createContext<Opening | null>(null);
export const useBrowserOpening = (): Opening | null =>
  useContext(OpeningContext);

function transferFocus(root: HTMLElement, id: string | null): void {
  const match =
    id === null
      ? null
      : root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(id)}"]`);
  match?.focus({ preventScroll: true });
  if (match !== null && root.ownerDocument.activeElement === match) return;
  const heading = root.querySelector<HTMLElement>('h1, [role="heading"]');
  if (heading !== null) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    if (root.ownerDocument.activeElement === heading) return;
  }
  root
    .querySelector<HTMLElement>('button:not([disabled]), a[href]')
    ?.focus({ preventScroll: true });
}

/** The document remains the only interactive surface until the route or recovery commits. */
export function BrowserOpening(props: {
  readonly root: HTMLElement;
  readonly children: JSX.Element;
}): JSX.Element {
  const root = untrack(() => props.root);
  // The inline opening document can be followed by its own inline script.
  let opening = root.ownerDocument.querySelector<HTMLElement>(
    '[data-startup-shell]'
  );
  if (opening === null) return props.children;
  const document = root.ownerDocument;
  const window = document.defaultView;
  const interactions = new AbortController();
  const themeEvents = new AbortController();
  onCleanup(() => {
    interactions.abort();
    themeEvents.abort();
  });
  const resumeActivity = (): void => interactions.abort();
  const reveal = (): void => {
    if (opening === null) return;
    const previous = opening;
    opening = null;
    const focused = document.activeElement;
    const restore = previous.contains(focused);
    const id =
      focused?.getAttribute('data-startup-focus') ??
      focused?.getAttribute('data-testid') ??
      null;
    themeEvents.abort();
    previous.remove();
    document.documentElement.removeAttribute('data-startup-preference');
    if (!restoreOpeningSearch(previous, root, focused) && restore)
      transferFocus(root, id);
    // Initial data can still be arriving. Give explicit actions their normal
    // progress feedback without turning those outstanding reads into spinners.
    const options = { capture: true, signal: interactions.signal };
    root.addEventListener('click', resumeActivity, options);
    root.addEventListener('keydown', resumeActivity, options);
    window?.addEventListener('popstate', resumeActivity, options);
  };
  const bindTheme = (setPreference: (value: ThemePreference) => void): void => {
    const readChoice = (): void => {
      const value = document.documentElement.getAttribute(
        'data-startup-preference'
      );
      if (value === 'light' || value === 'dark' || value === 'system')
        setPreference(value);
    };
    readChoice();
    opening?.addEventListener('startup-theme-change', readChoice, {
      signal: themeEvents.signal,
    });
  };
  return (
    <OpeningContext
      value={{
        ready: () =>
          opening === null ? undefined : finishOpeningGesture(opening, reveal),
        quietActivity: () => !interactions.signal.aborted,
        bindTheme,
      }}
    >
      {props.children}
    </OpeningContext>
  );
}

/** Inside the loading boundary so a suspended route keeps the document in charge. */
export function OpeningContent(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const opening = useBrowserOpening();
  if (opening !== null) onSettled(opening.ready);
  return <>{props.children}</>;
}
