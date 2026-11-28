import { expect, test } from 'bun:test';
import { createBrowserRequestHandler } from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import { chromeScreencast } from '@pkgs/ui-testing-bun-webview-server-ts/chrome-screencast';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: boot-review-frame-ack-collision
test('Chrome can present a recorded frame while processing a navigation command', async () => {
  const events = new EventTarget();
  const commands: string[] = [];
  let busy = false;
  const view = Object.assign(events, {
    async cdp<T>(method: string): Promise<T> {
      if (busy) throw new Error('Invalid state: a cdp() is already pending');
      busy = true;
      commands.push(method);
      if (method === 'Page.navigate') {
        events.dispatchEvent(
          new MessageEvent('Page.screencastFrame', {
            data: { sessionId: 1, metadata: { timestamp: 2 }, data: 'jpeg' },
          })
        );
      }
      await Promise.resolve();
      busy = false;
      return {} as T;
    },
  });
  const messages: unknown[] = [];
  const handler = createBrowserRequestHandler(
    async () => ({
      view,
      screencast: chromeScreencast(view),
      driver: {} as Driver,
      close: async () => {},
    }),
    (message) => messages.push(message)
  );
  await handler.handle({ id: 1, open: {} });
  await handler.handle({
    id: 2,
    call: { target: 'screencast', path: [], method: 'start', args: [] },
  });
  await handler.handle({
    id: 3,
    call: {
      target: 'view',
      path: [],
      method: 'cdp',
      args: ['Page.navigate', { url: 'https://example.test' }],
    },
  });
  await handler.handle({
    id: 4,
    call: { target: 'screencast', path: [], method: 'stop', args: [] },
  });
  expect(messages.at(-1)).toMatchObject({
    id: 4,
    value: [{ timestamp: 2, jpeg: 'jpeg' }],
  });
  expect(commands).toEqual([
    'Page.startScreencast',
    'Page.navigate',
    'Page.screencastFrameAck',
    'Page.stopScreencast',
  ]);
});
