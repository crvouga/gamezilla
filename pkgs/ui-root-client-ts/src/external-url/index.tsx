/** @jsxImportSource solid-js */

import { createContext, type JSX, untrack, useContext } from 'solid-js';

export type OpenExternalUrl = (url: string) => Promise<void>;

const ExternalUrlContext = createContext<OpenExternalUrl>();

export type ExternalUrlProviderProps = {
  readonly value: OpenExternalUrl;
  readonly children: JSX.Element;
};

/**
 * External-navigation seam: leaving the app for a provider-hosted page
 * (a payment provider's checkout or billing portal, …).
 *
 * The app never owns that page, so the port is a plain function: production
 * assigns the browser location, harnesses walk the provider's real screens
 * headlessly. Sub libs call `useOpenExternalUrl()` and stay host-agnostic.
 */
export function ExternalUrlProvider(
  props: ExternalUrlProviderProps
): JSX.Element {
  const open = untrack(() => props.value);
  return (
    <ExternalUrlContext.Provider value={open}>
      {props.children}
    </ExternalUrlContext.Provider>
  );
}

/** Explicit port for tests / hosts that never leave the app. */
export function StaticExternalUrlProvider(props: {
  readonly open?: OpenExternalUrl;
  readonly children: JSX.Element;
}): JSX.Element {
  const open = untrack(() => props.open ?? (() => Promise.resolve()));
  return (
    <ExternalUrlContext.Provider value={open}>
      {props.children}
    </ExternalUrlContext.Provider>
  );
}

export function useOpenExternalUrl(): OpenExternalUrl {
  const open = useContext(ExternalUrlContext);
  if (open === undefined) {
    throw new Error('useOpenExternalUrl: ExternalUrlProvider missing');
  }
  return open;
}
