import { describe, expect, it, mock } from 'bun:test';
import { BunWebviewDriver } from './bun-webview-driver';
import type { BunWebView } from './bun-webview-host';

function createFakeView(): BunWebView & {
  navigate: ReturnType<typeof mock>;
  click: ReturnType<typeof mock>;
  evaluate: ReturnType<typeof mock>;
  screenshot: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
} {
  return {
    navigate: mock(() => Promise.resolve()),
    click: mock(() => Promise.resolve()),
    evaluate: mock(async (script: string) => {
      if (script.includes('getComputedStyle')) return true;
      if (script.includes('getBoundingClientRect')) {
        return { x: 0, y: 0, width: 100, height: 100 };
      }
      if (script.includes('innerText') || script.includes('.value')) {
        return 'typed';
      }
      if (script.includes('outerHTML')) return '<html><body>ok</body></html>';
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
    expect(view.click).toHaveBeenCalledWith('[data-testid="submit"]');

    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.25 });
    expect(view.evaluate).toHaveBeenCalled();

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
    await driver.get('email').clear();
    await driver.key('enter');
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
    expect(view.click).toHaveBeenCalledWith(
      '[data-testid="parent"] [data-testid="child"]'
    );
  });
});
