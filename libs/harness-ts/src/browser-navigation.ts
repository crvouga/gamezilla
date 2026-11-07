import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';

export type BrowserNavigation = {
  currentUrl(): Promise<string>;
  waitForNavigation(
    match: (url: string) => boolean,
    timeoutMs: number
  ): Promise<string>;
};

/** Observe document replacement with the live journey's existing 250 ms cadence. */
export function createBrowserNavigation(args: {
  readonly readUrl: () => Promise<string>;
  readonly clock: Clock;
  readonly timers: Timers;
}): BrowserNavigation {
  return {
    currentUrl: args.readUrl,
    waitForNavigation: async (match, timeoutMs) => {
      const deadline = args.clock.now() + timeoutMs;
      let lastUrl = '';
      for (;;) {
        try {
          lastUrl = await args.readUrl();
          if (match(lastUrl)) return lastUrl;
        } catch {
          // Replacing a document can briefly make URL evaluation unavailable.
        }
        if (args.clock.now() >= deadline) {
          throw new Error(
            `no matching navigation within ${String(timeoutMs)}ms (current URL: ${lastUrl})`
          );
        }
        await new Promise<void>((resolve) =>
          args.timers.setTimeout(resolve, 250)
        );
      }
    },
  };
}
