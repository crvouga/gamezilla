/**
 * One actor's web browser, for everything the app hands off to the web: the
 * Google / Apple sign-in window (`openAuthSession`) and any page a composed feature
 * serves into it, such as a billing provider's hosted checkout
 * (`openExternalUrl`).
 *
 * It is a small but real browser. It loads documents over the actor's network
 * (the provider on its own origin, everything else through the load balancer),
 * keeps a cookie jar per origin so the provider remembers the person between
 * visits, follows redirects, and renders the page it lands on with that page's
 * own UI — the provider's screens, a feature's {@link HarnessBrowserAppPage} — so a
 * scenario signs in and pays by tapping those pages, exactly as it would in
 * a live browser. The page shows as a sheet over the app
 * (`HarnessBrowserSheet`); leaving it — the sign-in callback, a link back to the
 * app, the close button — returns to the app.
 */

import type { ServerHttp } from '@libs/client-app/shell/client-env';
import { HARNESS_SERVER_URL } from '@libs/feature/public/harness-constants';
import type {
  OpenAuthSession,
  OpenAuthSessionResult,
} from '@pkgs/auth-inhouse/client';
import { IDP_TEST_IDS } from '@pkgs/idp-mock/shared';
import type { OpenExternalUrl } from '@pkgs/ui';
import { type Accessor, createSignal } from 'solid-js';

import type { HarnessBrowserAppPage } from '../composition';
import { requestHref } from './harness-http-request';
import { harnessIdpOf } from './harness-idp';

/** Redirect hops one load may take (launch → provider → callback → app). */
const MAX_HOPS = 12;

export type HarnessBrowserPage =
  | { readonly kind: 'loading'; readonly url: string }
  | { readonly kind: 'idp'; readonly url: string; readonly html: string }
  | {
      readonly kind: 'app';
      readonly url: string;
      readonly page: HarnessBrowserAppPage;
    }
  | {
      readonly kind: 'error';
      readonly url: string;
      readonly message: string;
    };

/** One document load; a new load is a new page, even at the same URL. */
export type HarnessBrowserTab = {
  readonly id: number;
  readonly page: HarnessBrowserPage;
};

export type HarnessBrowser = {
  /** The open page, or `null` while the actor is in the app. */
  readonly tab: Accessor<HarnessBrowserTab | null>;
  /** The address bar (a step can change it without a document load). */
  readonly address: Accessor<string | null>;
  /** The page's network: the actor's, with this browser's cookies. */
  readonly fetch: ServerHttp;
  /** Load a document in the open tab (links, form navigations, redirects). */
  readonly navigate: (url: string) => void;
  /**
   * Submit a top-level form POST and load what it answers — Apple's
   * `response_mode=form_post` hand-off back to the app's API.
   */
  readonly post: (
    action: string,
    fields: Readonly<Record<string, string>>
  ) => void;
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

/** A URL in the app itself (not its API): leaving the web for the app. */
function isAppUrl(url: URL, appOrigin: string | null): boolean {
  if (url.origin === appOrigin) return true;
  return url.origin === HARNESS_SERVER_URL && !url.pathname.startsWith('/api/');
}

/** A POST the browser makes as part of one load (a form submission). */
type FormPost = {
  readonly url: URL;
  readonly fields: Readonly<Record<string, string>>;
};

/**
 * A provider's `form_post` hand-off document auto-submits by script; a
 * browser runs it, so this one does too.
 */
function autoSubmitted(url: URL, html: string): FormPost | null {
  if (!html.includes(IDP_TEST_IDS.formPostPage)) return null;
  const action = /<form[^>]*action="([^"]*)"/.exec(html)?.[1];
  if (action === undefined) return null;
  const fields: Record<string, string> = {};
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const name = /name="([^"]*)"/.exec(match[0])?.[1];
    const value = /value="([^"]*)"/.exec(match[0])?.[1] ?? '';
    if (name === undefined) continue;
    fields[name] = value
      .replaceAll('&quot;', '"')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');
  }
  return { url: new URL(action.replaceAll('&amp;', '&'), url), fields };
}

/** What a non-app response is: a redirect hop, an error, or a page to show. */
async function landedOn(
  url: URL,
  response: Response,
  pages: readonly HarnessBrowserAppPage[]
): Promise<HarnessBrowserPage | URL | FormPost> {
  const location = response.headers.get('location');
  if (location !== null) return new URL(location, url);
  if (!response.ok) {
    return {
      kind: 'error',
      url: url.href,
      message: `${String(response.status)} ${response.statusText}`.trim(),
    };
  }
  const page = pages.find((candidate) => candidate.matches(url));
  if (page !== undefined) return { kind: 'app', url: url.href, page };
  if (harnessIdpOf(url.href) !== null) {
    const html = await response.text();
    return autoSubmitted(url, html) ?? { kind: 'idp', url: url.href, html };
  }
  return { kind: 'error', url: url.href, message: 'Unsupported page' };
}

/** A navigation is a GET; an auto-submitted `form_post` is a form POST. */
function requestInitFor(hop: URL | FormPost): RequestInit {
  if (hop instanceof URL) return { redirect: 'manual' };
  return {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(hop.fields).toString(),
  };
}

export function createHarnessBrowser(args: {
  /** The actor's network: provider origin + load balancer. */
  readonly network: ServerHttp;
  /** Pages the composed features serve into the browser. */
  readonly pages: readonly HarnessBrowserAppPage[];
  /**
   * Where the app itself is served (its links back, e.g. a billing return
   * URL built from `window.location.origin`), or `null` when unknown.
   */
  readonly appOrigin: () => string | null;
  /** Runs when the sign-in window hands a callback back to the app. */
  readonly onAuthSuccess?: () => void;
}): HarnessBrowser {
  const fetch = withCookies(args.network);
  const [tab, setTab] = createSignal<HarnessBrowserTab | null>(null);
  const [address, setAddress] = createSignal<string | null>(null);
  let nextId = 1;
  let pendingAuth: PendingAuth | null = null;

  const show = (page: HarnessBrowserPage | null): void => {
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
  const settle = async (
    hop: URL | FormPost
  ): Promise<HarnessBrowserPage | 'app' | URL | FormPost> => {
    const url = hop instanceof URL ? hop : hop.url;
    if (pendingAuth !== null && url.href.startsWith(pendingAuth.callbackUrl)) {
      finishAuth({ type: 'success', url: url.href });
      return 'app';
    }
    if (isAppUrl(url, args.appOrigin())) return 'app';
    const response = await fetch(url.href, requestInitFor(hop));
    return await landedOn(url, response, args.pages);
  };

  const load = async (start: URL | FormPost): Promise<void> => {
    let hop = start;
    show({ kind: 'loading', url: (hop instanceof URL ? hop : hop.url).href });
    for (let count = 0; count < MAX_HOPS; count += 1) {
      const next = await settle(hop);
      if (next === 'app') {
        show(null);
        finishAuth({ type: 'cancel' });
        return;
      }
      if (next instanceof URL || 'fields' in next) {
        hop = next;
        continue;
      }
      show(next);
      return;
    }
    const last = hop instanceof URL ? hop : hop.url;
    show({ kind: 'error', url: last.href, message: 'Too many redirects' });
  };

  const run = (start: URL | FormPost): void => {
    void load(start).catch((err: unknown) => {
      show({
        kind: 'error',
        url: (start instanceof URL ? start : start.url).href,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };
  const navigate = (url: string): void => run(new URL(url));

  return {
    tab,
    address,
    fetch,
    navigate,
    post: (action, fields) => run({ url: new URL(action), fields }),
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
