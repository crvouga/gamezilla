import { describe, expect, it, mock } from 'bun:test';
import { BunWebviewDriver } from './bun-webview-driver';
import type { BunWebView } from './bun-webview-host';

function createFakeView(): BunWebView & {
  navigate: ReturnType<typeof mock>;
  click: ReturnType<typeof mock>;
  type: ReturnType<typeof mock>;
  press: ReturnType<typeof mock>;
  evaluate: ReturnType<typeof mock>;
  screenshot: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
} {
  return {
    navigate: mock(() => Promise.resolve()),
    click: mock(() => Promise.resolve()),
    type: mock(() => Promise.resolve()),
    press: mock(() => Promise.resolve()),
    evaluate: mock(async (script: string) => {
      if (script.includes('outerHTML')) return '<html><body>ok</body></html>';
      if (script.includes('return visible(el)')) return true;
      if (script.includes('getBoundingClientRect')) {
        return { x: 0, y: 0, width: 100, height: 100 };
      }
      if (script.includes('return { text: text(el) }'))
        return { text: 'typed' };
      if (script.includes('anyField(el)')) return true;
      if (script.includes('data-bun-webview-target')) return true;
      return undefined;
    }),
    screenshot: mock(() => Promise.resolve(new Uint8Array())),
    close: mock(() => undefined),
  };
}

describe('BunWebviewDriver', () => {
  it('maps testIds and user intents onto Bun.WebView APIs', async () => {
    const view = createFakeView();
    const driver = new BunWebviewDriver({
      view,
      baseUrl: 'http://localhost:3000',
    });

    await driver.launch();
    expect(view.navigate).toHaveBeenCalledWith('http://localhost:3000');

    await driver.get('submit').tap();
    expect(view.click).toHaveBeenCalledWith('[data-bun-webview-target]', {
      timeout: 1_000,
    });

    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.25 });
    expect(view.click).toHaveBeenCalledWith(50, 25);

    await driver
      .get('board')
      .drag({ xRatio: 0.1, yRatio: 0.1 }, { xRatio: 0.9, yRatio: 0.9 });

    expect(await driver.get('board').layout()).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    await driver.get('email').input('a@b.c');
    expect(view.type).toHaveBeenCalledWith('a@b.c');
    await driver.get('email').clear();
    expect(view.press).toHaveBeenCalledWith('Backspace');
    await driver.key('enter');
    expect(view.press).toHaveBeenCalledWith('Enter');
    await driver.get('list').scroll('down', 50);
    await driver.get('go').wait('visible');

    expect(await driver.get('hi').isVisible()).toBe(true);
    expect(await driver.get('email').text()).toBe('typed');
    expect(await driver.snapshotHtml()).toBe('<html><body>ok</body></html>');

    await driver.close();
    expect(view.close).toHaveBeenCalled();
  });

  it('chains nested get via descendant data-testid selectors', async () => {
    const view = createFakeView();
    const driver = new BunWebviewDriver({ view });

    await driver.get('parent').get('child').tap();
    const scripts = view.evaluate.mock.calls.map((call) => String(call[0]));
    expect(
      scripts.some((script) =>
        script.includes(
          JSON.stringify('[data-testid="parent"] [data-testid="child"]')
        )
      )
    ).toBe(true);
    expect(view.click).toHaveBeenCalledWith('[data-bun-webview-target]', {
      timeout: 1_000,
    });
  });
});
