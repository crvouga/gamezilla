import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { browserCallDiagnostics } from '@pkgs/ui-testing-bun-webview-server-ts/browser-call-diagnostics';
import {
  type BrowserDevice,
  createBrowserRequestHandler,
} from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';

async function runNodeCall(
  device: BrowserDevice,
  reports: string[],
  method: 'tap' | 'isVisible'
) {
  const handler = createBrowserRequestHandler(
    async () => device,
    (reply) => {
      if (
        reply &&
        typeof reply === 'object' &&
        'operation' in reply &&
        typeof reply.operation === 'string'
      )
        reports.push(reply.operation);
    }
  );
  await handler.handle({ id: 1, open: {} });
  return handler.handle({
    id: 2,
    call: {
      target: 'node',
      path: [method === 'tap' ? 'auth-method-google' : 'auth-signed-in-done'],
      method,
      args: [],
    },
  });
}

test.each(['click', 'acknowledgement'])(
  'a stalled %s is identifiable without asking the page for another evaluation',
  async (stalled) => {
    const time = createHarnessClock();
    const trace = browserCallDiagnostics(time.clock, time.timers);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let clicks = 0;
    const reports: string[] = [];
    async function stall() {
      entered.resolve();
      await release.promise;
    }
    const view = trace.view(
      {
        url: 'about:blank',
        loading: false,
        navigate: async () => {},
        press: async () => {},
        screenshot: async () => new Uint8Array(),
        close: () => {},
        click: async () => {
          if (stalled === 'click') await stall();
          clicks++;
        },
        evaluate: async (script) => {
          if (script.includes('__uiTestingPointerCounts')) {
            if (stalled === 'acknowledgement' && clicks === 1) await stall();
            return [clicks, clicks, clicks, 1, true];
          }
          if (script.includes('document.elementFromPoint'))
            return '[data-testid="auth-method-google"]';
          return true;
        },
      },
      'opener'
    );
    const driver = new BunWebviewDriver({ view, timers: time.timers });
    const tap = runNodeCall(
      { view, driver, traceCall: trace.traceCall, close: () => driver.close() },
      reports,
      'tap'
    );
    await entered.promise;
    expect(reports).toBeEmpty();
    time.clock.advance(5_000);
    const operation = stalled === 'click' ? 'opener.click' : 'opener.evaluate';
    expect(reports.at(-1)).toStartWith(operation);
    expect(reports.at(-1)).toMatch(/pending at native-click\.ts:\d+/);
    expect(reports.at(-1)).not.toContain('auth-method-google');
    release.resolve();
    await tap;
    expect(clicks).toBe(1);
    expect(time.clock.pendingOneShotCount()).toBe(0);
  }
);

test.each(['popup sync', 'visibility'])(
  'a suspended Done read identifies its %s evaluation',
  async (stage) => {
    const time = createHarnessClock();
    const diagnostics = browserCallDiagnostics(time.clock, time.timers);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const reports: string[] = [];
    const view = diagnostics.view(
      {
        url: 'http://app.test/sso-callback?code=private',
        loading: false,
        navigate: async () => {},
        press: async () => {},
        click: async () => {},
        screenshot: async () => new Uint8Array(),
        close: () => {},
        evaluate: async (script) => {
          if (stage === 'popup sync' || script.includes('getComputedStyle')) {
            entered.resolve();
            await release.promise;
          }
          return true;
        },
      },
      'opener'
    );
    const driver = new BunWebviewDriver({ view, timers: time.timers });
    const read = runNodeCall(
      {
        view,
        driver,
        traceCall: diagnostics.traceCall,
        close: () => driver.close(),
      },
      reports,
      'isVisible'
    );
    await entered.promise;
    time.clock.advance(5_000);
    const expected =
      stage === 'popup sync'
        ? 'bun-webview-popups.ts'
        : 'bun-webview-driver-node.ts';
    expect(reports.at(-1)).toStartWith('opener.evaluate');
    expect(reports.at(-1)).toContain(`pending at ${expected}:`);
    expect(reports.at(-1)).not.toContain('private');
    release.resolve();
    await read;
    expect(time.clock.pendingOneShotCount()).toBe(0);
  }
);
