import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createBrowserRequestHandler } from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';

// regression: provider-marker-opener-evaluation
test('a visible chooser in the main document takes one visibility evaluation', async () => {
  const scripts: string[] = [];
  const view = {
    evaluate: async (script: string) => {
      scripts.push(script);
      if (script.includes('__bunWebviewPopups'))
        throw new Error('opener popup shim stalled');
      return script.includes('oauth-mock-chooser');
    },
    click: async () => {},
    press: async () => {},
    close: () => {},
    navigate: async () => {},
    screenshot: async () => new Uint8Array(),
  };
  const driver = new BunWebviewDriver({
    view,
    timers: createHarnessClock().timers,
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
  expect(replies.at(-1)).toMatchObject({ id: 2, value: true });
  expect(scripts).toHaveLength(1);
  expect(scripts[0]).toContain('getComputedStyle');
});
