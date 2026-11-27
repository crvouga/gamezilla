import { expect, mock, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { browserCallDiagnostics } from '@pkgs/ui-testing-bun-webview-server-ts/browser-call-diagnostics';
import { createBrowserRequestHandler } from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import { chromeDocumentVisibility } from '@pkgs/ui-testing-bun-webview-server-ts/chrome-document-visibility';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import { visibilityScript } from '@pkgs/ui-testing-bun-webview-shared-ts/visibility-script';

async function chooserRead(
  evaluate: (script: string) => Promise<unknown>,
  readDocumentVisibility?: (expression: string) => Promise<boolean>
) {
  const view = {
    evaluate,
    click: async () => {},
    press: async () => {},
    close: () => {},
    navigate: async () => {},
    screenshot: async () => new Uint8Array(),
  };
  const driver = new BunWebviewDriver({
    view,
    timers: createHarnessClock().timers,
    ...(readDocumentVisibility && { readDocumentVisibility }),
  });
  const replies: unknown[] = [];
  const handler = createBrowserRequestHandler(
    async () => ({ view, driver, close: async () => {} }),
    (reply) => replies.push(reply)
  );
  await handler.handle({ id: 1, open: {} });
  await handler.handle({
    id: 2,
    call: {
      target: 'document-node',
      path: ['oauth-mock-chooser'],
      method: 'isVisible',
      args: [],
    },
  });
  return replies.at(-1);
}

// regression: provider-marker-opener-evaluation
test('a visible chooser in the main document takes one visibility evaluation', async () => {
  const scripts: string[] = [];
  const result = await chooserRead(async (script) => {
    scripts.push(script);
    if (script.includes('__bunWebviewPopups'))
      throw new Error('opener popup shim stalled');
    return script.includes('oauth-mock-chooser');
  });
  expect(result).toMatchObject({ id: 2, value: true });
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toContain('getComputedStyle');
});

// regression: provider-first-chooser-read
test.each([true, false])(
  'the Chrome chooser reports visibility %s while the WebView evaluation is stalled',
  async (visible) => {
    const pageEvaluate = mock(async () => {
      throw new Error(
        'opener.evaluate #1 (+1ms) pending at bun-webview-driver-node.ts:313'
      );
    });
    const cdp = mock(async () => ({
      result: { type: 'boolean', value: visible },
    }));
    const time = createHarnessClock();
    const diagnostics = browserCallDiagnostics(time.clock, time.timers);
    const view = {
      url: 'http://google.test',
      title: 'Choose an account · OAuth Emulator',
      loading: false,
      cdp,
    };
    const result = await chooserRead(
      pageEvaluate,
      chromeDocumentVisibility(view, diagnostics)
    );
    expect(result).toMatchObject({ id: 2, value: visible });
    expect(pageEvaluate).not.toHaveBeenCalled();
    expect(cdp).toHaveBeenCalledTimes(1);
    expect(cdp).toHaveBeenCalledWith('Runtime.evaluate', {
      expression: visibilityScript(['[data-testid="oauth-mock-chooser"]']),
      returnByValue: true,
      awaitPromise: false,
    });
  }
);

test('a slow chooser read reports a changing document without disclosing its URL or title', async () => {
  const time = createHarnessClock();
  const diagnostics = browserCallDiagnostics(time.clock, time.timers);
  const reply = Promise.withResolvers<{
    result: { value: boolean };
    exceptionDetails: unknown;
  }>();
  const view = {
    url: 'http://google.test',
    title: 'Choose an account · OAuth Emulator',
    loading: false,
    cdp: () => reply.promise,
  };
  const reports: string[] = [];
  const read = diagnostics.traceCall(
    () => chromeDocumentVisibility(view, diagnostics)('true'),
    (operation) => reports.push(operation)
  );
  view.url = 'http://app.test/?code=private';
  view.title = 'Private title';
  view.loading = true;
  time.clock.advance(5000);
  expect(reports).toEqual([
    'opener.cdp(Runtime.evaluate) [loading=true, navigation metadata changed=true] #1 (+0ms) pending',
  ]);
  reply.resolve({ result: { value: false }, exceptionDetails: {} });
  await expect(read).rejects.toThrow(
    'Chrome could not read document visibility'
  );
  expect(time.clock.pendingOneShotCount()).toBe(0);
});
