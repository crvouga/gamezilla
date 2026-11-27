import { expect, mock, test } from 'bun:test';
import { createBrowserRequestHandler } from '@pkgs/ui-testing-bun-webview-server-ts/browser-process-server';
import {
  chromeRegionMarker,
  documentMarker,
  visibleDocumentRegion,
} from '@pkgs/ui-testing-bun-webview-server-ts/document-region';
import {
  type BrowserCall,
  documentControls,
} from '@pkgs/ui-testing-bun-webview-server-ts/remote-browser-driver';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

const google = 'http://google.test';
const markers = {
  'Choose an account': 'oauth-mock-chooser',
  'Review access': 'oauth-mock-consent',
  'This sign-in expired': 'oauth-mock-error',
};
const chooser = {
  ignored: false,
  role: { value: 'region' },
  name: { value: 'Choose an account' },
};
const consent = { ...chooser, name: { value: 'Review access' } };

// regression: battleship-unknown-provider-first-read
test('the unknown Google document is identified by its exposed region through the browser process', async () => {
  const cdp = mock(async () => ({
    nodes: [chooser, { ...consent, ignored: true }],
  }));
  let reply: { value?: unknown };
  const handler = createBrowserRequestHandler(
    async () => ({
      view: { url: google, loading: false },
      driver: {} as Driver,
      close: async () => {},
      readRegionMarker: chromeRegionMarker(cdp),
    }),
    (message) => {
      reply = message as typeof reply;
    }
  );
  await handler.handle({ id: 1, open: {} });
  const controls = documentControls(async <T>(call: BrowserCall) => {
    await handler.handle({ id: 2, call });
    return reply.value as T;
  });
  expect(await controls.visibleRegion(google, markers)).toBe(
    'oauth-mock-chooser'
  );
  expect(cdp).toHaveBeenCalledTimes(1);
  expect(cdp).toHaveBeenCalledWith('Accessibility.getFullAXTree', {});
});

test.each([
  [[chooser, consent], null],
  [[{ ...chooser, ignored: true }], null],
  [[{ ...chooser, role: { value: 'heading' } }], null],
  [[{ ...chooser, name: { value: 'Back to your app' } }], null],
  [
    [{ ...chooser, name: { value: 'This sign-in expired' } }],
    'oauth-mock-error',
  ],
] as const)(
  'only a single matching form identifies the next action',
  async (nodes, expected) => {
    expect(await chromeRegionMarker(async () => ({ nodes }))(markers)).toBe(
      expected
    );
  }
);

test('a form read is scoped to the ready provider document, including a same-URL reload', async () => {
  let state = { url: 'http://app.test', loading: false, navigation: 1 };
  const read = mock(async () => 'oauth-mock-chooser');
  const region = visibleDocumentRegion(() => state, read);
  expect(await region(google, markers)).toBeNull();
  state = { ...state, url: google, loading: true };
  expect(await region(google, markers)).toBeNull();
  expect(read).not.toHaveBeenCalled();
  state = { ...state, loading: false };
  const result = region(google, markers);
  state = { ...state, navigation: 2 };
  expect(await result).toBeNull();
  expect(await region(google, markers)).toBe('oauth-mock-chooser');
});

test('WebKit identifies a visible form using its document controls', async () => {
  const read = documentMarker((id) => ({
    isVisible: async () => id === 'oauth-mock-consent',
  }));
  expect(await read(markers)).toBe('oauth-mock-consent');
});
