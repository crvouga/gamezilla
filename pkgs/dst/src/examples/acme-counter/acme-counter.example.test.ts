import { describe, test } from 'bun:test';
import { CounterApp, type CounterHost } from './counter-app';
import { happyDomHost, webViewHost } from './scenario';
import { webViewAvailable } from './webview-page';

type Harness = {
  readonly name: string;
  readonly host: () => CounterHost;
};

/**
 * Harness axis. WebView listed first — loading happy-dom in-process breaks
 * Bun.WebView spawn, so matrix cells run in this order.
 */
const HARNESSES: readonly Harness[] = [
  { name: 'Bun.WebView', host: webViewHost },
  { name: 'happy-dom', host: happyDomHost },
];

type Case = {
  readonly name: string;
  readonly run: (harness: Harness) => Promise<void>;
};

const CASES: readonly Case[] = [
  {
    name: 'scripted settings → step → increment → reset',
    async run(harness) {
      await using app = await CounterApp.open({ host: harness.host() });

      await app.openSettings();
      await app.setStep(5);
      await app.leaveSettings();

      await app.increment();
      await app.increment();
      await app.expectCount(10);
      await app.expectRoute('home');

      await app.openResetAndConfirm();
      await app.expectCount(0);
      await app.expectDecrementDisabled();
      await app.expectResetDisabled();
    },
  },
  {
    name: 'walk + replay',
    async run(harness) {
      await using app = await CounterApp.open({
        host: harness.host(),
        seed: 42,
      });
      await app.exploreAndReplay({ host: harness.host() });
    },
  },
];

describe.each([...HARNESSES])('acme-counter ($name)', (harness) => {
  const skipWebView = harness.name === 'Bun.WebView' && !webViewAvailable();

  for (const c of CASES) {
    test.skipIf(skipWebView)(c.name, () => c.run(harness), 15_000);
  }
});
