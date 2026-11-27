import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Timers } from '@pkgs/clock-shared-ts/types';
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

function pageState(html: string | null): string {
  const screen = innermostScreen(html);
  const startup = html?.match(/<div\b[^>]*\sdata-startup-shell\b[^>]*>/i)?.[0];
  if (startup)
    return startup.includes('startup-shell-failed')
      ? 'startup shell failed'
      : 'startup shell loading';
  if (html?.includes('data-component="LocalDatabaseBootErrorScreen"'))
    return 'local database boot error';
  if (html?.includes(`data-testid="${Handles.bootLoading}"`))
    return 'app boot loading';
  if (screen === null && html?.includes('data-component="ErrorState"'))
    return 'error screen';
  return `screen: ${screen ?? 'none'}`;
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
  readonly timers?: Timers;
}): Promise<string> {
  let place = 'an unreadable page';
  const read = async () => {
    if (args.browser !== undefined) {
      try {
        const url = new URL(await args.browser.currentUrl());
        if (url.protocol === 'http:' || url.protocol === 'https:')
          place =
            url.origin === args.appOrigin
              ? url.pathname
              : `${url.origin}${url.pathname}`;
        else place = url.href === 'about:blank' ? 'about:blank' : url.protocol;
      } catch {
        // A document being replaced has no readable location for a moment.
      }
    }
    let state = 'screen: none';
    try {
      state = pageState(await args.html());
    } catch {
      // A page that cannot be snapshotted still reports its location.
    }
    return `${place} (${state})`;
  };
  const timers = args.timers;
  if (!timers) return read();
  let timer: unknown;
  try {
    return await Promise.race([
      read(),
      new Promise<string>((resolve) => {
        timer = timers.setTimeout(
          () => resolve(`${place} (diagnosis timed out)`),
          1000
        );
      }),
    ]);
  } finally {
    timers.clearTimeout(timer);
  }
}
