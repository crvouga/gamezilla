import { describe, expect, it, mock } from 'bun:test';
import { wallTimers } from '@pkgs/clock';
import { BunWebviewDriver } from './bun-webview-driver';
import type { BunWebView } from './bun-webview-host';

type PointerCounts = { down: number; up: number };

function createFakeView(): BunWebView & {
  pointer: PointerCounts;
  navigate: ReturnType<typeof mock>;
  click: ReturnType<typeof mock>;
  evaluate: ReturnType<typeof mock>;
  screenshot: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
} {
  // Native clicks reach the page as trusted pointerdown + pointerup the driver counts.
  const pointer: PointerCounts = { down: 0, up: 0 };
  return {
    pointer,
    navigate: mock(() => Promise.resolve()),
    click: mock(() => {
      pointer.down += 1;
      pointer.up += 1;
      return Promise.resolve();
    }),
    evaluate: mock(async (script: string) => {
      if (script.includes('__uiTestingPointerCounts')) {
        return [pointer.down, pointer.up];
      }
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
      timers: wallTimers,
    });

    await driver.launch();
    expect(view.navigate).toHaveBeenCalledWith('http://localhost:3000');

    await driver.get('submit').tap();
    expect(view.click).toHaveBeenCalledWith('[data-testid="submit"]');

    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.25 });
    expect(view.click).toHaveBeenCalledWith(50, 25, { button: 'left' });
    expect(view.click).toHaveBeenCalledTimes(2);

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

  it('secondary tapAt is a native right click', async () => {
    const view = createFakeView();
    const driver = new BunWebviewDriver({ view, timers: wallTimers });
    await driver
      .get('board')
      .tapAt({ xRatio: 0.5, yRatio: 0.5 }, { button: 'secondary' });
    expect(view.click).toHaveBeenCalledWith(50, 50, { button: 'right' });
  });

  it('a secondary press lands on pointerdown (the context menu takes the up)', async () => {
    const view = createFakeView();
    view.click.mockImplementation(() => {
      view.pointer.down += 1;
      return Promise.resolve();
    });
    const driver = new BunWebviewDriver({ view, timers: wallTimers });
    await driver
      .get('board')
      .tapAt({ xRatio: 0.5, yRatio: 0.5 }, { button: 'secondary' });
    expect(view.click).toHaveBeenCalledTimes(1);
  });

  it('re-sends a native click the page never saw', async () => {
    const view = createFakeView();
    let dropped = 1;
    const deliver = view.click.getMockImplementation();
    view.click.mockImplementation((...args: unknown[]) => {
      if (dropped > 0) {
        dropped -= 1;
        return Promise.resolve();
      }
      return deliver?.(...args) ?? Promise.resolve();
    });
    const driver = new BunWebviewDriver({ view, timers: wallTimers });
    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.5 });
    expect(view.click).toHaveBeenCalledTimes(2);
  });

  it('completes a press whose pointerup WebKit turned into a pointermove', async () => {
    const view = createFakeView();
    // A physical button held elsewhere: down lands, up does not; after the
    // release the re-send's mousedown is a chorded pointermove + pointerup.
    const deliveries: PointerCounts[] = [
      { down: 1, up: 0 },
      { down: 0, up: 1 },
    ];
    view.click.mockImplementation(() => {
      const next = deliveries.shift() ?? { down: 1, up: 1 };
      view.pointer.down += next.down;
      view.pointer.up += next.up;
      return Promise.resolve();
    });
    const driver = new BunWebviewDriver({ view, timers: wallTimers });
    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.5 });
    expect(view.click).toHaveBeenCalledTimes(2);
  });

  it('re-sends until a stale pressed pointer yields a whole tap', async () => {
    const view = createFakeView();
    // Pointer still "pressed" from an earlier lost pointerup: the first click
    // only releases it; the next lands as pointerdown + pointerup.
    const deliveries: PointerCounts[] = [
      { down: 0, up: 0 },
      { down: 0, up: 1 },
    ];
    view.click.mockImplementation(() => {
      const next = deliveries.shift() ?? { down: 1, up: 1 };
      view.pointer.down += next.down;
      view.pointer.up += next.up;
      return Promise.resolve();
    });
    const driver = new BunWebviewDriver({ view, timers: wallTimers });
    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.5 });
    expect(view.click).toHaveBeenCalledTimes(3);
  });

  it('chains nested get via descendant data-testid selectors', async () => {
    const view = createFakeView();
    const driver = new BunWebviewDriver({ view, timers: wallTimers });

    await driver.get('parent').get('child').tap();
    expect(view.click).toHaveBeenCalledWith(
      '[data-testid="parent"] [data-testid="child"]'
    );
  });
});
