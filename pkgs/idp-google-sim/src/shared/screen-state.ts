/**
 * The screen contract both hosts render through.
 *
 * One value decides everything the human sees. The server renders it into HTML
 * for a browser without JavaScript (and for the headless walkers), the browser
 * app renders the same Solid tree for a real browser, and neither host may
 * invent a screen the other does not have.
 */

import { IDP_BRAND } from './brand';
import {
  IDP_AUTHORIZE_BACK_PATH,
  IDP_AUTHORIZE_CREATE_PATH,
  IDP_AUTHORIZE_PASSWORD_PATH,
} from './paths';
import type { IdpAccount } from './types';

export type IdpScreenState =
  | {
      readonly kind: 'identifier';
      readonly requestId: string;
      readonly appName: string;
      readonly email: string;
      readonly error: string | null;
      readonly accounts: readonly IdpAccount[];
    }
  | {
      readonly kind: 'password';
      readonly requestId: string;
      readonly appName: string;
      readonly account: IdpAccount;
      readonly error: string | null;
      readonly hasPasskey: false;
    }
  | {
      readonly kind: 'chooser';
      readonly requestId: string;
      readonly appName: string;
      readonly accounts: readonly IdpAccount[];
    }
  | {
      readonly kind: 'create-account';
      readonly requestId: string;
      readonly appName: string;
      readonly name: string;
      readonly email: string;
      readonly error: string | null;
    }
  | {
      readonly kind: 'consent';
      readonly requestId: string;
      readonly appName: string;
      readonly account: IdpAccount;
      readonly scopes: readonly string[];
    }
  | {
      readonly kind: 'error';
      readonly status: number;
      readonly error: string;
      readonly detail: string;
    };

/** Focus target for a step change: the card region holding the screen's `h1`. */
export const IDP_SCREEN_REGION_ID = 'idp-screen';

/** One arm of {@link IdpScreenState}, for a route component's props. */
export type IdpScreenStateOf<K extends IdpScreenState['kind']> = Extract<
  IdpScreenState,
  { kind: K }
>;

/**
 * What one step produced: another screen, or a real navigation back to the
 * relying party. The redirect arm is why the browser app never renders a
 * callback itself — the callback is a document load, as it is on Google.
 */
export type IdpScreenOutcome =
  | { readonly kind: 'screen'; readonly state: IdpScreenState }
  | { readonly kind: 'redirect'; readonly location: string };

/** Boot-state element the server shell writes and the browser app reads. */
export const IDP_BOOT_STATE_ELEMENT_ID = 'idp-screen-state';

/**
 * Step transitions, implemented by the browser app against `/rpc/*`. The
 * screens only call these: nothing under `web/src/routes` may touch `location`,
 * `document` or `fetch`, so the server render stays event-handler free.
 */
export type ScreenActions = {
  readonly submitIdentifier: (email: string) => Promise<void>;
  readonly submitPassword: (password: string) => Promise<void>;
  readonly submitChoose: (sub: string) => Promise<void>;
  readonly submitCreateAccount: (name: string, email: string) => Promise<void>;
  readonly submitConsent: (decision: 'allow' | 'deny') => Promise<void>;
  /**
   * Leave the SPA for one of the provider's own document routes (the back
   * arrow, "Create account", "Sign in instead"). Those are GET screens with
   * their own URL, so they are real navigations rather than client-side step
   * transitions — and the routes must not reach for `location` themselves.
   */
  readonly openDocument: (url: string) => void;
};

/** The server renders a form no script will submit; these are never called. */
export const IDP_NOOP_SCREEN_ACTIONS: ScreenActions = {
  submitIdentifier: async () => undefined,
  submitPassword: async () => undefined,
  submitChoose: async () => undefined,
  submitCreateAccount: async () => undefined,
  submitConsent: async () => undefined,
  openDocument: () => undefined,
};

export function titleOf(state: IdpScreenState): string {
  switch (state.kind) {
    case 'chooser':
      return 'Choose an account';
    case 'create-account':
      return `Create your ${IDP_BRAND.name} account`;
    case 'error':
      return `Error · ${IDP_BRAND.name}`;
    default:
      return `Sign in · ${IDP_BRAND.name}`;
  }
}

/** The parked request behind a screen, when the screen came from one. */
export function requestIdOf(state: IdpScreenState): string | null {
  return 'requestId' in state ? state.requestId : null;
}

/** Where the back arrow points; `null` when the screen is the first step. */
export function backHrefOf(state: IdpScreenState): string | null {
  const requestId = requestIdOf(state);
  if (requestId === null || state.kind === 'identifier') return null;
  return `${IDP_AUTHORIZE_BACK_PATH}?request_id=${encodeURIComponent(requestId)}`;
}

/**
 * The URL that reproduces this step on a refresh. Only the two steps that have
 * their own GET route qualify; every other screen is reached from the
 * authorize URL the relying party opened.
 */
export function urlOf(state: IdpScreenState): string | null {
  const requestId = requestIdOf(state);
  if (requestId === null) return null;
  if (state.kind === 'password') {
    return `${IDP_AUTHORIZE_PASSWORD_PATH}?request_id=${encodeURIComponent(requestId)}`;
  }
  if (state.kind === 'create-account') {
    return `${IDP_AUTHORIZE_CREATE_PATH}?request_id=${encodeURIComponent(requestId)}`;
  }
  return null;
}
