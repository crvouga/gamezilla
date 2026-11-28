/** @jsxImportSource @solidjs/web */

import type { ThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import type { JSX } from '@solidjs/web';
import { createContext, onCleanup, onSettled, untrack, useContext } from 'solid-js';

type Opening = {
  readonly ready: () => void;
  readonly quietActivity: () => boolean;
  readonly bindTheme: (setPreference: (value: ThemePreference) => void) => void;
};

const OpeningContext = createContext<Opening>();
export const useBrowserOpening = (): Opening | undefined => useContext(OpeningContext);

function transferFocus(root: HTMLElement, id: string | null): void {
  const match = id === null ? null : root.querySelector<HTMLElement>(
    `[data-testid="${CSS.escape(id)}"]`
  );
  match?.focus({ preventScroll: true });
  if (match !== null && root.ownerDocument.activeElement === match) return;
  const heading = root.querySelector<HTMLElement>('h1, [role="heading"]');
  if (heading !== null) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    if (root.ownerDocument.activeElement === heading) return;
  }
  root.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus({ preventScroll: true });
}

/** The document remains the only interactive surface until the route or recovery commits. */
export function BrowserOpening(props: {
  readonly root: HTMLElement;
  readonly children: JSX.Element;
}): JSX.Element {
  const root = untrack(() => props.root);
  // The inline opening document can be followed by its own inline script.
  const opening = root.ownerDocument.querySelector<HTMLElement>('[data-startup-shell]');
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
  const ready = (): void => {
    if (!opening.isConnected) return;
    const focused = document.activeElement;
    const restore = opening.contains(focused);
    const id = focused?.getAttribute('data-testid') ?? null;
    themeEvents.abort();
    opening.remove();
    document.documentElement.removeAttribute('data-startup-preference');
    if (restore) transferFocus(root, id);
    // Initial data can still be arriving. Give explicit actions their normal
    // progress feedback without turning those outstanding reads into spinners.
    const options = { capture: true, signal: interactions.signal };
    root.addEventListener('click', resumeActivity, options);
    root.addEventListener('keydown', resumeActivity, options);
    window?.addEventListener('popstate', resumeActivity, options);
  };
  const bindTheme = (setPreference: (value: ThemePreference) => void): void => {
    const readChoice = (): void => {
      const value = document.documentElement.getAttribute('data-startup-preference');
      if (value === 'light' || value === 'dark' || value === 'system') setPreference(value);
    };
    readChoice();
    window?.addEventListener('startup-theme-change', readChoice, { signal: themeEvents.signal });
  };
  return (
    <OpeningContext value={{ ready, quietActivity: () => !interactions.signal.aborted, bindTheme }}>
      {props.children}
    </OpeningContext>
  );
}

/** Inside the loading boundary so a suspended route keeps the document in charge. */
export function OpeningContent(props: { readonly children: JSX.Element }): JSX.Element {
  const opening = useBrowserOpening();
  if (opening !== undefined) onSettled(opening.ready);
  return <>{props.children}</>;
}
