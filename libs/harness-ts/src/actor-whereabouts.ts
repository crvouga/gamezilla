import type { BrowserNavigation } from './browser-navigation';

const SCREEN_MARKER = /data-screen="([^"]+)"/g;

/** The innermost screen a page's markup declares, or null when it has none. */
export function innermostScreen(html: string | null): string | null {
  let screen: string | null = null;
  for (const match of (html ?? '').matchAll(SCREEN_MARKER)) {
    screen = match[1] ?? screen;
  }
  return screen;
}

/**
 * Where a live actor is, for a failure message: the page's origin when it is
 * not the app's, its path (never the query, which can carry codes and
 * tokens), and the screen it shows.
 */
export async function describeWhereabouts(args: {
  readonly browser: BrowserNavigation | undefined;
  readonly appOrigin: string | null;
  readonly html: () => Promise<string | null>;
}): Promise<string> {
  let place = 'an unreadable page';
  if (args.browser !== undefined) {
    try {
      const url = new URL(await args.browser.currentUrl());
      place =
        args.appOrigin !== null && url.origin === args.appOrigin
          ? url.pathname
          : `${url.origin}${url.pathname}`;
    } catch {
      // A document being replaced has no readable location for a moment.
    }
  }
  let screen: string | null = null;
  try {
    screen = innermostScreen(await args.html());
  } catch {
    // A page that cannot be snapshotted still reports its location.
  }
  return `${place} (screen: ${screen ?? 'none'})`;
}
