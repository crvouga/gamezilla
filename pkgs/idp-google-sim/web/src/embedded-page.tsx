/**
 * The provider's screens hosted by someone else's browser.
 *
 * A browser host (a simulation's per-actor browser, say) loads a provider URL
 * itself — cookies, redirects and all — and hands this component the document
 * it got back. From there it behaves exactly like the SPA: the same
 * {@link Screen} tree, the same `/rpc/*` step transitions over the host's
 * `fetch`, and real navigations (the redirect back to the relying party, the
 * back arrow, "Create account") handed back to the host as document loads.
 */

import { hc } from 'hono/client';
import { createSignal, type JSX, onMount } from 'solid-js';

import type { IdpAppType } from '../../src/server/app';
import {
  IDP_BOOT_STATE_ELEMENT_ID,
  type IdpScreenOutcome,
  type IdpScreenState,
  requestIdOf,
  urlOf,
} from '../../src/shared/screen-state';
import { createScreenActions } from './actions';
import { parseScreenState } from './boot-state';
import { focusScreen } from './dom';
import { Screen } from './screen';

export type IdpEmbeddedFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type IdpEmbeddedPageProps = {
  /** The document's URL (after redirects). */
  readonly url: string;
  /** The document the provider served for {@link url}. */
  readonly html: string;
  /** The host browser's network: carries the provider's session cookie. */
  readonly fetch: IdpEmbeddedFetch;
  /** Load a new document (absolute URL). */
  readonly navigate: (url: string) => void;
  /** A step changed the address without a document load. */
  readonly onLocationChange?: (url: string) => void;
};

/** The boot state the provider's shell wrote next to its markup. */
export function readEmbeddedScreenState(html: string): IdpScreenState {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.getElementById(IDP_BOOT_STATE_ELEMENT_ID)?.textContent;
  if (text === undefined || text === null || text.length === 0) {
    throw new Error('idp: the document carries no screen state');
  }
  return parseScreenState(JSON.parse(text) as unknown);
}

export function IdpEmbeddedPage(props: IdpEmbeddedPageProps): JSX.Element {
  const [state, setState] = createSignal(readEmbeddedScreenState(props.html));
  const [busy, setBusy] = createSignal(false);
  const resolve = (url: string): string => new URL(url, props.url).toString();
  const client = hc<IdpAppType>(`${new URL(props.url).origin}/`, {
    fetch: props.fetch,
  });
  const apply = (outcome: IdpScreenOutcome): void => {
    if (outcome.kind === 'redirect') {
      props.navigate(resolve(outcome.location));
      return;
    }
    setState(outcome.state);
    const stepUrl = urlOf(outcome.state);
    if (stepUrl !== null) props.onLocationChange?.(resolve(stepUrl));
    focusScreen();
  };
  const actions = createScreenActions({
    client,
    requestId: () => requestIdOf(state()) ?? '',
    apply,
    setBusy,
    openDocument: (url) => props.navigate(resolve(url)),
  });
  onMount(focusScreen);
  return <Screen state={state()} actions={actions} busy={busy()} />;
}
