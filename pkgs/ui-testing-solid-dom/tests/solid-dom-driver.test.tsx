/** @jsxImportSource solid-js */
import { Box, Text } from '@pkgs/ui';
import { TimeoutError, UiTestError } from '@pkgs/ui-testing/core/errors';
import {
  createSolidDomDriver,
  isBlankSnapshotHtml,
  type SolidDomDriver,
} from '@pkgs/ui-testing-solid-dom';
import { createSignal, type JSX } from 'solid-js';
import { afterEach, describe, expect, test } from 'vitest';
import { createDemoClock, DemoApp, DemoProviders } from './support/demo-app';

function demoDriver(): SolidDomDriver {
  const sim = createDemoClock();
  return createSolidDomDriver({
    clock: sim.clock,
    pump: sim.pump,
    harness: { createRoot: () => () => <DemoApp sim={sim} /> },
  });
}

function customDriver(root: () => JSX.Element): SolidDomDriver {
  const sim = createDemoClock();
  return createSolidDomDriver({
    clock: sim.clock,
    pump: sim.pump,
    harness: {
      createRoot: () => () => <DemoProviders sim={sim}>{root()}</DemoProviders>,
    },
  });
}

describe('SolidDomDriver', () => {
  let driver: SolidDomDriver | undefined;

  afterEach(async () => {
    await driver?.close();
    driver = undefined;
  });

  test('signs in through the public API and snapshots the result', async () => {
    driver = demoDriver();
    await driver.launch();
    expect(driver.kind).toBe('solid-dom');

    await driver.get('email').expect.visible();
    await driver.get('password').expect.visible();
    await driver.get('submit').expect.visible();

    await driver.get('email').input('ada@example.com');
    await driver.get('password').input('secret');
    await driver.get('email').expect.text('ada@example.com');

    await driver.get('email').clear();
    await driver.get('email').expect.text('');

    await driver.get('email').input('ada@example.com');
    await driver.get('submit').tap();

    await driver.get('home').expect.visible();
    await driver.get('email').expect.hidden();
    await driver.get('welcome').expect.text('Welcome ada@example.com');
    await driver.get('welcome').expect.text('ada@', { exact: false });

    const html = await driver.snapshotHtml();
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('data-testid="home"');
    expect(html).toContain('Welcome ada@example.com');
    expect(html).toContain('data-screen="home"');
    expect(isBlankSnapshotHtml(html ?? undefined)).toBe(false);
    const linked = await driver.snapshotHtml({ stylesheetHref: 'frame.css' });
    expect(linked).toContain('<link rel="stylesheet" href="frame.css" />');
  });

  test('tap updates state; isVisible reports without waiting', async () => {
    driver = demoDriver();
    await driver.launch();
    expect(await driver.get('count').isVisible()).toBe(true);
    expect(await driver.get('missing').isVisible()).toBe(false);
    expect(await driver.get('hidden-note').isVisible()).toBe(false);
    await driver.get('inc').tap();
    await driver.get('inc').tap();
    await driver.get('count').expect.text('2');
    expect(await driver.get('count').text()).toBe('2');
  });

  test('Enter in the email field submits via onSubmitEditing', async () => {
    driver = demoDriver();
    await driver.launch();
    await driver.get('password').input('secret');
    await driver.get('email').input('ada@example.com');
    await driver.get('email').key('enter');
    await driver.get('home').expect.visible();
  });

  test('finds portal content and dismisses it with Escape at page scope', async () => {
    driver = demoDriver();
    await driver.launch();
    await driver.get('help-dialog').expect.hidden();
    await driver.get('open-help').tap();
    await driver.get('help-dialog').expect.visible();
    await driver.get('help-dialog').get('help-close').expect.visible();
    expect(await driver.get('help-dialog').text()).toContain('Help');
    await driver.key('escape');
    await driver.get('help-dialog').expect.hidden();

    await driver.get('open-help').tap();
    await driver.get('help-dialog').get('help-close').tap();
    await driver.get('help-dialog').expect.hidden();
  });

  test('scopes nested get to the parent subtree', async () => {
    driver = customDriver(() => (
      <>
        <Box dataSet={{ testid: 'parent-a' }}>
          <Text label="A" dataSet={{ testid: 'label' }} />
        </Box>
        <Box dataSet={{ testid: 'parent-b' }}>
          <Text label="B" dataSet={{ testid: 'label' }} />
        </Box>
      </>
    ));
    await driver.launch();
    expect(await driver.get('parent-a').get('label').text()).toBe('A');
    expect(await driver.get('parent-b').get('label').text()).toBe('B');
    expect(await driver.get('parent-b').get('nope').isVisible()).toBe(false);
  });

  test('scroll moves a ScrollView host and fires scroll', async () => {
    driver = demoDriver();
    await driver.launch();
    await driver.get('login-form').scroll('down', 40);
    const scroller = document.querySelector(
      '[data-component="ScreenBodyScroll"]'
    );
    expect(scroller?.scrollTop).toBe(40);
    await driver.get('login-form').scroll('up', 100);
    expect(scroller?.scrollTop).toBe(0);
  });

  test('layout synthesizes a box from inline size and tapAt/drag hit it', async () => {
    const points: string[] = [];
    driver = customDriver(() => (
      <Box
        sx={{ width: 200, height: 100 }}
        dataSet={{ testid: 'board' }}
        onPointerDown={(e) => points.push(`down:${e.clientX},${e.clientY}`)}
        onPointerUp={(e) => points.push(`up:${e.clientX},${e.clientY}`)}
      />
    ));
    await driver.launch();
    expect(await driver.get('board').layout()).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    await driver.get('board').tapAt({ xRatio: 0.5, yRatio: 0.5 });
    await driver
      .get('board')
      .drag({ xRatio: 0, yRatio: 0 }, { xRatio: 1, yRatio: 1 });
    expect(points).toEqual([
      'down:100,50',
      'up:100,50',
      'down:0,0',
      'up:200,100',
    ]);
  });

  test('wait(text) observes async updates driven by the pump', async () => {
    const [label, setLabel] = createSignal('before');
    const sim = createDemoClock();
    driver = createSolidDomDriver({
      clock: sim.clock,
      pump: sim.pump,
      harness: {
        createRoot: () => () => (
          <DemoProviders sim={sim}>
            <Text label={label()} dataSet={{ testid: 'label' }} />
          </DemoProviders>
        ),
      },
    });
    await driver.launch();
    sim.timers.setTimeout(() => setLabel('after'), 5);
    await driver.get('label').wait({ text: 'after' }, { timeoutMs: 500 });
    expect(await driver.get('label').text()).toBe('after');
  });

  test('wait times out with TimeoutError / UiTestError on the injected clock', async () => {
    driver = demoDriver();
    await driver.launch();
    await expect(
      driver.get('missing').wait('visible', { timeoutMs: 50 })
    ).rejects.toBeInstanceOf(TimeoutError);
    await expect(
      driver.get('missing').wait('visible', { timeoutMs: 50 })
    ).rejects.toThrow(
      'Timed out after 50ms waiting for visible testId("missing")'
    );
    const textError = await driver
      .get('count')
      .expect.text('99', { timeoutMs: 50 })
      .catch((error: unknown) => error);
    expect(textError).toBeInstanceOf(UiTestError);
    expect((textError as Error).message).toContain('got "0"');
    expect((textError as Error).cause).toBeInstanceOf(TimeoutError);
  });

  test('close unmounts the tree and launch requires a harness root', async () => {
    driver = demoDriver();
    await driver.launch();
    expect(document.querySelector('[data-actor]')).not.toBeNull();
    await driver.close();
    expect(document.querySelector('[data-actor]')).toBeNull();
    await expect(driver.get('email').isVisible()).rejects.toThrow(
      'Driver not launched'
    );
  });
});
