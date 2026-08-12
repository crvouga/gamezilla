import { afterEach, describe, expect, it } from '@jest/globals';
import { wallIo } from '@pkgs/io';
import { createDriver } from '../../driver/create-driver';
import { demoHarness } from './demo-app';
import { InProcessDriver } from './in-process-driver';

const io = wallIo();
const clockOpts = { now: io.clock.now, timers: io.timers };

describe('InProcessDriver', () => {
  let driver: InProcessDriver;

  afterEach(async () => {
    await driver?.close();
  });

  it('boots via createDriver and exercises the public API', async () => {
    driver = createDriver({
      kind: 'in-process',
      harness: demoHarness,
      ...clockOpts,
    }) as InProcessDriver;

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
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();

    expect(await driver.isVisible('count')).toBe(true);
    expect(await driver.isVisible('missing')).toBe(false);

    await driver.tap('inc');
    await driver.expect.text('count', '1');
  });

  it('scrolls without throwing', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.scroll('login-scroll', 'down', 40);
  });

  it('pressKey does not throw when focus is on an input', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.tap('email');
    await driver.key('tab');
  });
});
