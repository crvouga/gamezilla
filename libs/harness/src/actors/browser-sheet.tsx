/** @jsxImportSource solid-js */
/**
 * The actor's web browser, drawn as a sheet over the app — how an in-app
 * browser (the sign-in window, a hosted billing page) looks on a phone.
 *
 * The page body is the page's own UI: the provider's screens
 * (`@pkgs/idp-mock/embedded`) or a page a composed feature serves
 * (`HarnessComposition.browserPages`), on the browser's network. Links
 * inside it are document loads, so a click on one goes to the browser rather
 * than to the host document.
 *
 * `isolateStyles` renders the page into a shadow root with the page's own
 * stylesheet, so a live document (the product harness) shows it as designed
 * without the page's CSS reaching the app. Tests leave it off: the driver
 * queries the light DOM and happy-dom paints no CSS.
 */

import { IdpEmbeddedPage } from '@pkgs/idp-mock/embedded';
import { IDP_SPA_CSS } from '@pkgs/idp-mock/server/assets.generated';
import { type JSX, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { render } from 'solid-js/web';
import type {
  HarnessBrowser,
  HarnessBrowserPage,
  HarnessBrowserTab,
} from '../fabric/browser';

export const HARNESS_BROWSER_TEST_IDS = {
  sheet: 'harness-browser',
  close: 'harness-browser-close',
  address: 'harness-browser-address',
} as const;

export type HarnessBrowserSheetProps = {
  readonly browser: HarnessBrowser;
  readonly isolateStyles: boolean;
};

function pageCss(page: HarnessBrowserPage): string {
  if (page.kind === 'idp') return IDP_SPA_CSS;
  if (page.kind === 'app') return page.page.css;
  return '';
}

/** A click on a link inside the page loads that document in the browser. */
function interceptLinks(
  element: HTMLElement,
  pageUrl: () => string,
  navigate: (url: string) => void
): () => void {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = event
      .composedPath()
      .find(
        (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement
      );
    const href = anchor?.getAttribute('href');
    if (href === undefined || href === null || href.startsWith('#')) return;
    event.preventDefault();
    navigate(new URL(href, pageUrl()).toString());
  };
  element.addEventListener('click', onClick);
  return () => element.removeEventListener('click', onClick);
}

function PageBody(props: {
  readonly browser: HarnessBrowser;
  readonly page: HarnessBrowserPage;
}): JSX.Element {
  const navigate = (url: string): void => props.browser.navigate(url);
  return (
    <Switch>
      <Match when={props.page.kind === 'idp' ? props.page : undefined}>
        {(page) => (
          <IdpEmbeddedPage
            fetch={props.browser.fetch}
            html={page().html}
            navigate={navigate}
            post={(action, fields) => props.browser.post(action, fields)}
            onLocationChange={(url) => props.browser.setAddress(url)}
            url={page().url}
          />
        )}
      </Match>
      <Match when={props.page.kind === 'app' ? props.page : undefined}>
        {(page) =>
          page().page.render({
            fetch: props.browser.fetch,
            navigate,
            url: page().url,
          })
        }
      </Match>
      <Match when={props.page.kind === 'error' ? props.page : undefined}>
        {(page) => (
          <p class="p-6 text-sm">
            This page can't be reached: {page().message}
          </p>
        )}
      </Match>
      <Match when={props.page.kind === 'loading'}>
        <p class="p-6 text-sm opacity-60">Loading…</p>
      </Match>
    </Switch>
  );
}

/** The page rendered into its own shadow root, with its own stylesheet. */
function ShadowPage(props: {
  readonly css: string;
  readonly children: () => JSX.Element;
}): JSX.Element {
  let host!: HTMLDivElement;
  onMount(() => {
    const root = host.attachShadow({ mode: 'open' });
    const dispose = render(
      () => (
        <>
          <style>{props.css}</style>
          {props.children()}
        </>
      ),
      root
    );
    onCleanup(dispose);
  });
  return <div class="min-h-full" ref={host} />;
}

function Sheet(props: {
  readonly browser: HarnessBrowser;
  readonly tab: HarnessBrowserTab;
  readonly isolateStyles: boolean;
}): JSX.Element {
  let body!: HTMLDivElement;
  onMount(() => {
    onCleanup(
      interceptLinks(
        body,
        () => props.browser.address() ?? props.tab.page.url,
        (url) => props.browser.navigate(url)
      )
    );
  });
  const host = (): string => {
    const address = props.browser.address() ?? props.tab.page.url;
    return new URL(address).host;
  };
  const page = (): JSX.Element => (
    <PageBody browser={props.browser} page={props.tab.page} />
  );
  return (
    <div
      class="absolute inset-0 z-harness-browser flex flex-col bg-system-canvas text-system-text color-scheme-system"
      data-testid={HARNESS_BROWSER_TEST_IDS.sheet}
    >
      <div class="flex h-11 shrink-0 items-center gap-2 border-system-text/10 border-b bg-system-canvas px-2">
        <button
          aria-label="Close"
          class="flex size-8 items-center justify-center rounded-full text-lg leading-none hover:bg-system-text/10"
          data-testid={HARNESS_BROWSER_TEST_IDS.close}
          onClick={() => props.browser.close()}
          type="button"
        >
          ×
        </button>
        <span
          class="min-w-0 flex-1 truncate rounded-full bg-system-text/5 px-3 py-1 text-center text-xs opacity-70"
          data-testid={HARNESS_BROWSER_TEST_IDS.address}
        >
          {host()}
        </span>
        <span class="size-8" />
      </div>
      <div class="min-h-0 flex-1 overflow-auto" ref={body}>
        <Show fallback={page()} when={props.isolateStyles}>
          <ShadowPage css={pageCss(props.tab.page)}>{page}</ShadowPage>
        </Show>
      </div>
    </div>
  );
}

export function HarnessBrowserSheet(
  props: HarnessBrowserSheetProps
): JSX.Element {
  return (
    <Show keyed when={props.browser.tab()}>
      {(tab) => (
        <Sheet
          browser={props.browser}
          isolateStyles={props.isolateStyles}
          tab={tab}
        />
      )}
    </Show>
  );
}
