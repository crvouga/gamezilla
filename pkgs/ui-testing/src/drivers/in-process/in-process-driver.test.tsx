import { afterEach, describe, expect, it } from '@jest/globals';
import { wallIo } from '@pkgs/io';
import { NotImplementedError } from '../../core/errors';
import { createDriver } from '../../driver/create-driver';
import { by } from '../../selector/selector';
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

    await driver.expectVisible(by.testId('email'));
    await driver.expectVisible(by.label('Email'));
    await driver.expectVisible(by.role('button', 'Submit'));
    await driver.expectVisible(by.text('Sign in'));

    await driver.input(by.testId('email'), 'ada@example.com');
    await driver.input(by.label('Password'), 'secret');
    await driver.expectText(by.testId('email'), 'ada@example.com');

    await driver.clear(by.testId('email'));
    await driver.expectText(by.testId('email'), '');

    await driver.input(by.testId('email'), 'ada@example.com');
    await driver.tap(by.testId('submit'));

    await driver.expectVisible(by.testId('home'));
    await driver.expectHidden(by.testId('email'));
    await driver.expectText(by.testId('welcome'), 'Welcome ada@example.com');

    const html = await driver.snapshotHtml();
    expect(html).toContain('data-testid="home"');
    expect(html).toContain('Welcome ada@example.com');
  });

  it('supports tap on the counter and reports visibility', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();

    expect(await driver.isVisible(by.testId('count'))).toBe(true);
    expect(await driver.isVisible(by.testId('missing'))).toBe(false);

    await driver.tap(by.testId('inc'));
    await driver.expectText(by.testId('count'), '1');
  });

  it('scrolls without throwing', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.scroll(by.testId('login-scroll'), 'down', 40);
  });

  it('throws NotImplementedError for navigateBack', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await expect(driver.back()).rejects.toBeInstanceOf(NotImplementedError);
  });

  it('pressKey does not throw when focus is on an input', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.tap(by.testId('email'));
    await driver.key('tab');
  });
});
