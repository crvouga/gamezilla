import { afterEach, describe, expect, it } from 'bun:test';
import { wallIo } from '@pkgs/io';
import {
  expectHidden,
  expectText,
  expectVisible,
} from '../../assertions/assertions';
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

    await expectVisible(driver, by.testId('email'));
    await expectVisible(driver, by.label('Email'));
    await expectVisible(driver, by.role('button', 'Submit'));
    await expectVisible(driver, by.text('Sign in'));

    await driver.typeText(by.testId('email'), 'ada@example.com');
    await driver.typeText(by.label('Password'), 'secret');
    await expectText(driver, by.testId('email'), 'ada@example.com');

    await driver.clearText(by.testId('email'));
    await expectText(driver, by.testId('email'), '');

    await driver.typeText(by.testId('email'), 'ada@example.com');
    await driver.tap(by.testId('submit'));

    await expectVisible(driver, by.testId('home'));
    await expectHidden(driver, by.testId('email'));
    await expectText(driver, by.testId('welcome'), 'Welcome ada@example.com');
  });

  it('supports tap on the counter and reports visibility', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();

    expect(await driver.isVisible(by.testId('count'))).toBe(true);
    expect(await driver.isVisible(by.testId('missing'))).toBe(false);

    await driver.tap(by.testId('inc'));
    await expectText(driver, by.testId('count'), '1');
  });

  it('scrolls without throwing', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.scroll(by.testId('login-scroll'), 'down', 40);
  });

  it('throws NotImplementedError for navigateBack', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await expect(driver.navigateBack()).rejects.toBeInstanceOf(
      NotImplementedError
    );
  });

  it('pressKey does not throw when focus is on the document', async () => {
    driver = new InProcessDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.tap(by.testId('email'));
    await driver.pressKey('tab');
  });
});
