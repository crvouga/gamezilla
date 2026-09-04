import { describe, test } from 'bun:test';
import { CounterApp } from './counter-app';
import { webViewAvailable } from './webview-page';

/**
 * WebView first — loading happy-dom in-process breaks Bun.WebView spawn.
 */
function hosts(): string[] {
  const list: string[] = [];
  if (webViewAvailable()) list.push('webview');
  list.push('happy-dom');
  return list;
}

describe('acme-counter', () => {
  for (const host of hosts()) {
    describe(host, () => {
      test('scripted settings → step → increment → reset', async () => {
        await using app = await CounterApp.open({ host });

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
      });

      test('walk + replay', async () => {
        await using app = await CounterApp.open({
          host,
          seed: 42,
        });
        await app.exploreAndReplay();
      });
    });
  }
});
