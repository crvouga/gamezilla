import { expect, test } from 'bun:test';
import { createBrowserRequestHandler } from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import { chromeDocumentLoad } from '@pkgs/ui-testing-bun-webview-server-ts/chrome-document-load';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

// regression: battleship-google-chooser-before-dom
test('Bob reads the provider after its main document is ready despite the earlier loading=false', async () => {
  const view = Object.assign(new EventTarget(), {
    url: 'http://app.test',
    title: 'Account',
    loading: false,
  });
  const isDocumentLoading = chromeDocumentLoad(view);
  const replies: { value?: unknown }[] = [];
  const handler = createBrowserRequestHandler(
    async () => ({
      view,
      driver: {} as Driver,
      isDocumentLoading,
      close: async () => {},
    }),
    (reply) => replies.push(reply as { value?: unknown })
  );
  await handler.handle({ id: 1, open: {} });
  const document = async () => {
    await handler.handle({
      id: 2,
      call: { target: 'view', path: [], method: 'readyDocument', args: [] },
    });
    return replies.at(-1)?.value;
  };
  const event = (type: string, frameId = 'main') =>
    view.dispatchEvent(new MessageEvent(type, { data: { frameId } }));
  event('Page.frameStartedLoading');
  event('Page.domContentEventFired');
  event('Page.frameStoppedLoading');
  event('Page.frameStartedLoading');
  view.url = 'http://google.test/authorize';
  event('Page.frameStartedLoading', 'child');
  event('Page.frameStoppedLoading', 'child');
  expect(await document()).toBeNull();
  event('Page.domContentEventFired');
  // A stale title can now be resolved by checking the real visible form.
  expect(await document()).toEqual({
    origin: 'http://google.test',
    title: 'Account',
  });
  event('Page.frameStartedLoading', 'child');
  expect(isDocumentLoading()).toBe(false);
  event('Page.frameStartedLoading');
  event('Page.frameStoppedLoading');
  expect(isDocumentLoading()).toBe(false);
});
