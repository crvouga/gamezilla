import { expect, test } from 'bun:test';
import {
  type BrowserDevice,
  createBrowserRequestHandler,
} from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

/** A view like `Bun.WebView`'s: one `evaluate()` in flight at a time. */
function device() {
  let inFlight = 0;
  const settle: (() => void)[] = [];
  const view = {
    url: 'http://127.0.0.1:33333/sso-callback?code=x',
    title: 'Continue to your app · OAuth Emulator',
    loading: false,
    evaluate: () => {
      if (inFlight > 0)
        return Promise.reject(
          new Error('Invalid state: an evaluate() is already pending')
        );
      inFlight += 1;
      return new Promise<string>((resolve) =>
        settle.push(() => {
          inFlight -= 1;
          resolve('done');
        })
      );
    },
  };
  let closed = 0;
  const value: BrowserDevice = {
    driver: {} as Driver,
    view,
    close: () => {
      closed += 1;
      return Promise.resolve();
    },
  };
  return { value, view, settle, closed: () => closed };
}

const evaluate = (id: number) => ({
  id,
  call: { target: 'view' as const, path: [], method: 'evaluate', args: ['1'] },
});

// regression: quoridor-space-link-opening
test('Bob starts the invitation document in the foreground after using another tab', async () => {
  const url =
    'http://127.0.0.1:38451/space/7a1831a1-2fe8-409c-993a-5344130fba5c';
  let foreground = false;
  const documents: { url: string; foreground: boolean }[] = [];
  const browser = {
    ...device().value,
    activateBeforeNavigate: async () => {
      foreground = true;
    },
    view: {
      navigate: async (url: string) => {
        documents.push({ url, foreground });
      },
    },
  };
  const handler = createBrowserRequestHandler(
    async () => browser,
    () => {}
  );
  await handler.handle({ id: 1, open: {} });
  await handler.handle({
    id: 2,
    call: { target: 'view', method: 'navigate', path: [], args: [url] },
  });
  expect(documents).toEqual([{ url, foreground: true }]);
});

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

test('a call sent while another still runs waits its turn instead of colliding in the view', async () => {
  // regression: isolated-browser-concurrent-evaluate
  const d = device();
  const sent: { id: number; value?: unknown; error?: string }[] = [];
  const handler = createBrowserRequestHandler(
    () => Promise.resolve(d.value),
    (message) => sent.push(message as (typeof sent)[number])
  );
  await handler.handle({ id: 1, open: {} });
  const first = handler.handle(evaluate(2));
  const second = handler.handle(evaluate(3));
  await flush();
  expect(d.settle).toHaveLength(1);
  d.settle[0]!();
  await first;
  await flush();
  d.settle[1]!();
  await second;
  const replies = sent.filter((m) => 'value' in m || 'error' in m);
  expect(replies.map((m) => [m.id, m.error ?? m.value])).toEqual([
    [1, true],
    [2, 'done'],
    [3, 'done'],
  ]);
});

test('native navigation metadata and closing are answered while a page call is stuck', async () => {
  const d = device();
  const sent: { id: number; value?: unknown }[] = [];
  const handler = createBrowserRequestHandler(
    () => Promise.resolve(d.value),
    (message) => sent.push(message as (typeof sent)[number])
  );
  await handler.handle({ id: 1, open: {} });
  void handler.handle(evaluate(2));
  const origin = {
    target: 'view' as const,
    path: [],
    method: 'readyDocument',
    args: [],
  };
  d.view.loading = true;
  await handler.handle({ id: 5, call: origin });
  d.view.loading = false;
  await handler.handle({ id: 6, call: origin });
  expect(sent.find((m) => m.id === 5 && 'value' in m)?.value).toBeNull();
  expect(sent.find((m) => m.id === 6 && 'value' in m)?.value).toEqual({
    origin: 'http://127.0.0.1:33333',
    title: 'Continue to your app · OAuth Emulator',
  });
  await handler.handle({
    id: 3,
    call: { target: 'view', path: [], method: 'loadedUrl', args: [] },
  });
  await handler.handle({
    id: 4,
    call: { target: 'driver', path: [], method: 'close', args: [] },
  });
  expect(sent.find((m) => m.id === 3 && 'value' in m)?.value).toBe(
    'http://127.0.0.1:33333/sso-callback?code=x'
  );
  expect(d.closed()).toBe(1);
  expect(handler.device()).toBeNull();
});
