/**
 * The hosted pages for one session link, as a component. The browser entry
 * mounts it over the page's own URL; a simulated browser mounts it over the
 * URL it loaded, with its own network and navigation.
 */
import type { JSX } from 'solid-js';

import { createPageApi, type PageFetch } from './api';
import { MockBillingApp, pageOf } from './app';

export type MockBillingEmbeddedPageProps = {
  /** The session link: `…/c/pay/<id>` or `…/p/session/<id>`. */
  readonly url: string;
  readonly fetch: PageFetch;
  /** Load another document (the success, cancel or return link). */
  readonly navigate: (url: string) => void;
  readonly setTitle?: (title: string) => void;
};

export function MockBillingEmbeddedPage(
  props: MockBillingEmbeddedPageProps
): JSX.Element {
  // A session link is fixed for the page's lifetime; a new link is a new page.
  const url = new URL(props.url);
  const api = createPageApi({
    fetch: (target, init) => props.fetch(target, init),
    origin: url.origin,
  });
  return (
    <MockBillingApp
      api={api}
      navigate={(target) => props.navigate(target)}
      page={pageOf(url)}
      setTitle={(title) => props.setTitle?.(title)}
    />
  );
}
