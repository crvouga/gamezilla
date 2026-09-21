/**
 * One actor's web browser, for everything the app hands off to the web: the
 * Google sign-in window (`openAuthSession`) and the billing provider's hosted
 * checkout / portal (`openExternalUrl`).
 *
 * It is a small but real browser. It loads documents over the actor's network
 * (the provider on its own origin, everything else through the load balancer),
 * keeps a cookie jar per origin so the provider remembers the person between
 * visits, follows redirects, and renders the page it lands on with that page's
 * own UI — the provider's screens, the mock billing pages — so a scenario
 * signs in and manages billing by tapping those pages, exactly as it would in
 * a live browser. The page shows as a sheet over the app
 * (`SimBrowserSheet`); leaving it — the sign-in callback, a link back to the
 * app, the close button — returns to the app.
 */

import type {
  OpenAuthSession,
  OpenAuthSessionResult,
  ServerHttp,
} from '@libs/client-app/shell/client-env';
import {
  SIM_IDP_URL,
  SIM_SERVER_URL,
} from '@libs/server-app/sim/sim-constants';
import type { OpenExternalUrl } from '@pkgs/ui';
import { type Accessor, createSignal } from 'solid-js';

import { requestHref } from './sim-http-request';

/** Redirect hops one load may take (launch → provider → callback → app). */
const MAX_HOPS = 12;

const BILLING_PAGES = /^\/api\/billing\/mock\/(checkout|portal)$/;

export type SimBrowserPage =
  | { readonly kind: 'loading'; readonly url: string }
  | { readonly kind: 'idp'; readonly url: string; readonly html: string }
  | { readonly kind: 'billing'; readonly url: string }
  | {
      readonly kind: 'error';
      readonly url: string;
      readonly message: string;
    };

/** One document load; a new load is a new page, even at the same URL. */
export type SimBrowserTab = {
  readonly id: number;
  readonly page: SimBrowserPage;
};

export type SimBrowser = {
  /** The open page, or `null` while the actor is in the app. */
  readonly tab: Accessor<SimBrowserTab | null>;
  /** The address bar (a step can change it without a document load). */
  readonly address: Accessor<string | null>;
  /** The page's network: the actor's, with this browser's cookies. */
  readonly fetch: ServerHttp;
  /** Load a document in the open tab (links, form navigations, redirects). */
  readonly navigate: (url: string) => void;
  readonly setAddress: (url: string) => void;
  /** The person closes the window without finishing. */
  readonly close: () => void;
  readonly openAuthSession: OpenAuthSession;
  readonly openExternalUrl: OpenExternalUrl;
};

type PendingAuth = {
  readonly callbackUrl: string;
  readonly resolve: (result: OpenAuthSessionResult) => void;
};

/** Cookies scoped by host, as a browser scopes them. */
function createCookieJar(): {
  header(url: string): string;
  absorb(url: string, response: Response): void;
} {
  const jars = new Map<string, Map<string, string>>();
  const jarOf = (url: string): Map<string, string> => {
    const host = new URL(url).host;
    let jar = jars.get(host);
    if (jar === undefined) {
      jar = new Map();
      jars.set(host, jar);
    }
    return jar;
  };
  return {
    header: (url) =>
      [...jarOf(url)].map(([name, value]) => `${name}=${value}`).join('; '),
    absorb(url, response) {
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';')[0] ?? '';
        const at = pair.indexOf('=');
        if (at > 0) jarOf(url).set(pair.slice(0, at), pair.slice(at + 1));
      }
    },
  };
}

function withCookies(network: ServerHttp): ServerHttp {
  const jar = createCookieJar();
  return async (input, init) => {
    const url = requestHref(input);
    const headers = new Headers(init?.headers);
    const cookies = jar.header(url);
    if (cookies.length > 0) headers.set('cookie', cookies);
    const response = await network(url, { ...init, headers });
    jar.absorb(url, response);
    return response;
  };
}

function isBillingPage(url: URL): boolean {
  return url.origin === SIM_SERVER_URL && BILLING_PAGES.test(url.pathname);
}

/** A URL in the app itself (not its API): leaving the web for the app. */
function isAppUrl(url: URL, appOrigin: string | null): boolean {
  if (url.origin === appOrigin) return true;
  return url.origin === SIM_SERVER_URL && !url.pathname.startsWith('/api/');
}

export function createSimBrowser(args: {
  /** The actor's network: provider origin + load balancer. */
  readonly network: ServerHttp;
  /**
   * Where the app itself is served (its links back, e.g. a billing return
   * URL built from `window.location.origin`), or `null` when unknown.
   */
  readonly appOrigin: () => string | null;
  /** Runs when the sign-in window hands a callback back to the app. */
  readonly onAuthSuccess?: () => void;
}): SimBrowser {
  const fetch = withCookies(args.network);
  const [tab, setTab] = createSignal<SimBrowserTab | null>(null);
  const [address, setAddress] = createSignal<string | null>(null);
  let nextId = 1;
  let pendingAuth: PendingAuth | null = null;

  const show = (page: SimBrowserPage | null): void => {
    setTab(page === null ? null : { id: nextId++, page });
    setAddress(page?.url ?? null);
  };

  const finishAuth = (result: OpenAuthSessionResult): void => {
    const pending = pendingAuth;
    pendingAuth = null;
    if (pending === null) return;
    if (result.type === 'success') args.onAuthSuccess?.();
    pending.resolve(result);
  };

  /** Where one hop lands: done (app / callback), a page, or another hop. */
  const settle = async (url: URL): Promise<SimBrowserPage | 'app' | URL> => {
    if (pendingAuth !== null && url.href.startsWith(pendingAuth.callbackUrl)) {
      finishAuth({ type: 'success', url: url.href });
      return 'app';
    }
    if (isAppUrl(url, args.appOrigin())) return 'app';
    const response = await fetch(url.href, { redirect: 'manual' });
    const location = response.headers.get('location');
    if (location !== null) return new URL(location, url);
    if (!response.ok) {
      return {
        kind: 'error',
        url: url.href,
        message: `${String(response.status)} ${response.statusText}`.trim(),
      };
    }
    if (isBillingPage(url)) return { kind: 'billing', url: url.href };
    if (url.origin === SIM_IDP_URL) {
      return { kind: 'idp', url: url.href, html: await response.text() };
    }
    return { kind: 'error', url: url.href, message: 'Unsupported page' };
  };

  const load = async (start: string): Promise<void> => {
    show({ kind: 'loading', url: start });
    let url = new URL(start);
    for (let hop = 0; hop < MAX_HOPS; hop += 1) {
      const next = await settle(url);
      if (next === 'app') {
        show(null);
        finishAuth({ type: 'cancel' });
        return;
      }
      if (next instanceof URL) {
        url = next;
        continue;
      }
      show(next);
      return;
    }
    show({ kind: 'error', url: url.href, message: 'Too many redirects' });
  };

  const navigate = (url: string): void => {
    void load(url).catch((err: unknown) => {
      show({
        kind: 'error',
        url,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };

  return {
    tab,
    address,
    fetch,
    navigate,
    setAddress,
    close: () => {
      show(null);
      finishAuth({ type: 'cancel' });
    },
    openAuthSession: (authorizationUrl, callbackUrl) => {
      finishAuth({ type: 'cancel' });
      const { promise, resolve } =
        Promise.withResolvers<OpenAuthSessionResult>();
      pendingAuth = { callbackUrl, resolve };
      navigate(authorizationUrl);
      return promise;
    },
    openExternalUrl: (url) => {
      navigate(url);
      return Promise.resolve();
    },
  };
}
