import { describe, expect, it, mock } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import type { BunWebView } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-host';

/** Popup-load timeouts only; the fake view settles first, so none fire. */
const timers = createHarnessClock().timers;

type PointerCounts = { down: number; up: number; click?: number };

function createFakeView(): BunWebView & {
  pointer: PointerCounts;
  navigate: ReturnType<typeof mock>;
  click: ReturnType<typeof mock>;
  press: ReturnType<typeof mock>;
  evaluate: ReturnType<typeof mock>;
  screenshot: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
} {
  // Native clicks reach the page as trusted pointerdown + pointerup the driver counts.
  const pointer: PointerCounts = { down: 0, up: 0, click: 0 };
  return {
    pointer,
    navigate: mock(() => Promise.resolve()),
    click: mock(() => {
      pointer.down += 1;
      pointer.up += 1;
      pointer.click = (pointer.click ?? 0) + 1;
      return Promise.resolve();
    }),
    press: mock(() => Promise.resolve()),
    evaluate: mock(async (script: string) => {
      if (script.includes('__uiTestingPointerCounts')) {
        return [pointer.down, pointer.up, pointer.click ?? 0, 1, true];
      }
      // Before `getComputedStyle`: the text read uses it to skip hidden branches.
      if (script.includes('visibleText') || script.includes('.value')) {
        return 'typed';
      }
      if (script.includes('getComputedStyle')) return true;
      if (script.includes('getBoundingClientRect')) {
        return { x: 0, y: 0, width: 100, height: 100 };
      }
      if (script.includes('outerHTML')) return '<html><body>ok</body></html>';
      return undefined;
    }),
    screenshot: mock(() => Promise.resolve(new Uint8Array())),
    close: mock(() => undefined),
  };
}

describe('BunWebviewDriver', () => {
  it('rejects an off-target trusted click without sending another gesture', async () => {
    // regression: browser-tap-accepts-unrelated-click
    const view = createFakeView();
    const fallback = view.evaluate.getMockImplementation();
    view.evaluate.mockImplementation((script: string) => {
      if (script.includes('document.elementFromPoint'))
        return Promise.resolve('[data-ui-testing-press-target="10"]');
      if (script.includes('__uiTestingPointerCounts'))
        return Promise.resolve([
          view.pointer.down,
          view.pointer.up,
          view.pointer.click,
          1,
          false,
          'BUTTON[data-testid=other-action]',
        ]);
      return fallback?.(script);
    });
    await expect(
      new BunWebviewDriver({ view, timers }).get('content-start-attempt').tap()
    ).rejects.toThrow(
      'trusted click missed the selected control; hit BUTTON[data-testid=other-action]'
    );
    expect(view.click).toHaveBeenCalledTimes(1);
  });
  it('enabled waits for a visible control to clear its native disabled flag', async () => {
    // regression: browser-enabled-state-attribute-round-trips
    const view = createFakeView();
    const fallback = view.evaluate.getMockImplementation();
    let disabled = true;
    let observe: (() => void) | undefined;
    const observed = new Promise<void>((resolve) => {
      observe = resolve;
    });
    view.evaluate.mockImplementation((script: string) => {
      if (script.includes('controlIsEnabled')) {
        const value = !disabled;
        observe!();
        return Promise.resolve(value);
      }
      return fallback?.(script);
    });
    const driver = new BunWebviewDriver({ view, timers });
    let ready = false;
    const waiting = driver
      .get('pending')
      .wait('enabled')
      .then(() => {
        ready = true;
      });
    await observed;
    expect(ready).toBe(false);
    disabled = false;
    await waiting;
    expect(ready).toBe(true);
    expect(view.click).not.toHaveBeenCalled();
  });
  it('does not repeat a delivered click after its page navigates', async () => {
    // regression: browser-tap-repeats-after-navigation
    const view = createFakeView();
    const evaluate = view.evaluate.getMockImplementation();
    let documentId = 1;
    view.evaluate.mockImplementation((script: string) => {
      if (script.includes('__uiTestingPointerCounts'))
        return Promise.resolve([
          view.pointer.down,
          view.pointer.up,
          view.pointer.click,
          documentId,
          true,
        ]);
      return evaluate?.(script);
    });
    view.click.mockImplementation(() => {
      documentId += 1;
      view.pointer.down = 0;
      view.pointer.up = 0;
      view.pointer.click = 0;
      return Promise.resolve();
    });
    await new BunWebviewDriver({ view, timers })
      .get('oauth-mock-account-alice-add25969-gmail-com')
      .tapAt({ xRatio: 0.5, yRatio: 0.5 });
    expect(view.click).toHaveBeenCalledTimes(1);
  });
  it('does not repeat a delivered menu click when pointerup is suppressed', async () => {
    // regression: browser-tap-repeats-delivered-click
    const view = createFakeView();
    const evaluate = view.evaluate.getMockImplementation();
    view.evaluate.mockImplementation((script: string) =>
      script.includes('document.elementFromPoint')
        ? Promise.resolve('[data-ui-testing-press-target="1"]')
        : evaluate?.(script)
    );
    view.click.mockImplementation(() => {
      view.pointer.down += 1;
      view.pointer.click = (view.pointer.click ?? 0) + 1;
      return Promise.resolve();
    });
    await new BunWebviewDriver({ view, timers })
      .get('status-current-user')
      .tap();
    expect(view.click).toHaveBeenCalledTimes(1);
    expect(view.pointer).toEqual({ down: 1, up: 0, click: 1 });
  });

  it.each([1, 2])(
    'a click delivered after %i acknowledgement polls is never sent again',
    async (deliveryPolls) => {
      // regression: browser-tap-repeats-late-click
      const view = createFakeView();
      const fallback = view.evaluate.getMockImplementation();
      let late = false;
      let polls = 0;
      view.evaluate.mockImplementation((script: string) => {
        if (script.includes('document.elementFromPoint'))
          return Promise.resolve('[data-ui-testing-press-target="1"]');
        if (script.includes('setTimeout') && late) polls += 1;
        if (polls >= deliveryPolls && late) {
          view.pointer.click = (view.pointer.click ?? 0) + 1;
          late = false;
        }
        return fallback?.(script);
      });
      view.click.mockImplementation(() => {
        view.pointer.down += 1;
        view.pointer.up += 1;
        late = true;
        if (view.click.mock.calls.length > 1)
          view.pointer.click = (view.pointer.click ?? 0) + 1;
        return Promise.resolve();
      });
      await new BunWebviewDriver({ view, timers }).get('find-opponent').tap();
      expect(view.click).toHaveBeenCalledTimes(1);
    }
  );

  it('a menu tap completes a pointer press before returning', async () => {
    // regression: browser-menu-tap-incomplete-pointer
    const view = createFakeView();
    const evaluate = view.evaluate.getMockImplementation();
    view.evaluate.mockImplementation((script: string) =>
      script.includes('document.elementFromPoint')
        ? Promise.resolve('[data-ui-testing-press-target="1"]')
        : evaluate?.(script)
    );
    const deliveries: PointerCounts[] = [
      { down: 1, up: 0 },
      { down: 0, up: 1 },
    ];
    view.click.mockImplementation(() => {
      const next = deliveries.shift()!;
      view.pointer.down += next.down;
      view.pointer.up += next.up;
      if (next.up > 0) view.pointer.click = (view.pointer.click ?? 0) + 1;
      return Promise.resolve();
    });
    await new BunWebviewDriver({ view, timers })
      .get('global-menu-account')
      .tap();
    expect(view.pointer).toEqual({ down: 1, up: 1, click: 1 });
    expect(view.click).toHaveBeenCalledTimes(2);
  });

  it('reads existing production attributes from the selected application', async () => {
    const view = createFakeView();
    const evaluate = view.evaluate.getMockImplementation();
    view.evaluate.mockImplementation((script: string) =>
      script.includes('getAttribute')
        ? Promise.resolve(script.includes('data-fen') ? 'position' : null)
        : evaluate?.(script)
    );
    const node = new BunWebviewDriver({ view, timers }).get('multiplayer-game');
    expect(await node.attribute('data-fen')).toBe('position');
    expect(await node.attribute('missing')).toBeNull();
  });

  it('maps testIds and user intents onto Bun.WebView APIs', async () => {
    const view = createFakeView();
    const driver = new BunWebviewDriver({
      view,
      baseUrl: 'http://localhost:3000',
      timers,
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
    expect(
      view.evaluate.mock.calls.some(([script]) =>
        script.includes('KeyboardEvent')
      )
    ).toBe(true);
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
    const driver = new BunWebviewDriver({ view, timers });
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
    const driver = new BunWebviewDriver({ view, timers });
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
    const driver = new BunWebviewDriver({ view, timers });
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
    const driver = new BunWebviewDriver({ view, timers });
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
    const driver = new BunWebviewDriver({ view, timers });
    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.5 });
    expect(view.click).toHaveBeenCalledTimes(3);
  });

  it('chains nested get via descendant data-testid selectors', async () => {
    const view = createFakeView();
    const driver = new BunWebviewDriver({ view, timers });

    await driver.get('parent').get('child').tap();
    expect(view.click).toHaveBeenCalledWith(
      '[data-testid="parent"] [data-testid="child"]'
    );
  });
});
