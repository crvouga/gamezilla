import { afterEach, describe, expect, it } from '@jest/globals';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createDriver } from '../../driver/create-driver';
import { demoHarness } from './demo-app';
import { RntlDriver } from './rntl-driver';

const clockOpts = { now: wallClock.now, timers: wallTimers };

describe('RntlDriver', () => {
  let driver: RntlDriver;

  afterEach(async () => {
    await driver?.close();
  });

  it('boots via createDriver and exercises the public API', async () => {
    driver = createDriver({
      kind: 'rntl',
      harness: demoHarness,
      ...clockOpts,
    }) as RntlDriver;

    await driver.launch();

    await driver.expect.visible('email');
    await driver.expect.visible('password');
    await driver.expect.visible('submit');

    await driver.input('email', 'ada@example.com');
    await driver.input('password', 'secret');
    await driver.expect.text('email', 'ada@example.com');

    await driver.clear('email');
    await driver.expect.text('email', '');

    await driver.input('email', 'ada@example.com');
    await driver.tap('submit');

    await driver.expect.visible('home');
    await driver.expect.hidden('email');
    await driver.expect.text('welcome', 'Welcome ada@example.com');

    const html = await driver.snapshotHtml();
    expect(html).toContain('data-testid="home"');
    expect(html).toContain('Welcome ada@example.com');
  });

  it('supports tap on the counter and reports visibility', async () => {
    driver = new RntlDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();

    expect(await driver.isVisible('count')).toBe(true);
    expect(await driver.isVisible('missing')).toBe(false);

    await driver.tap('inc');
    await driver.expect.text('count', '1');
  });

  it('scrolls without throwing', async () => {
    driver = new RntlDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.scroll('login-scroll', 'down', 40);
  });

  it('pressKey does not throw when focus is on an input', async () => {
    driver = new RntlDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.tap('email');
    await driver.key('tab');
  });

  it('wait text uses pump then activate so React commits before the next check', async () => {
    let committed = 'before';
    let pending = 'before';
    let activates = 0;
    let pumps = 0;

    const harness = {
      mount: async () => ({
        query: () => ({}) as never,
        isVisible: () => true,
        getText: () => committed,
        tap: async () => undefined,
        tapAt: async () => undefined,
        typeText: async () => undefined,
        clearText: async () => undefined,
        pressKey: async () => undefined,
        scroll: async () => undefined,
        unmount: () => undefined,
        activate: async () => {
          activates += 1;
          committed = pending;
        },
      }),
    };

    driver = new RntlDriver({
      harness,
      ...clockOpts,
      pump: () => {
        pumps += 1;
        pending = 'after';
      },
    });
    await driver.launch();
    await driver.wait('label', { text: 'after' }, { timeoutMs: 500 });

    expect(committed).toBe('after');
    expect(activates).toBe(2);
    expect(pumps).toBe(1);
  });
});
