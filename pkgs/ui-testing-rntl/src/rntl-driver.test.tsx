import { afterEach, describe, expect, it } from 'bun:test';
import { wallClock, wallTimers } from '@pkgs/clock';
import type { AppHarness } from '@pkgs/ui-testing/bootstrap/app-harness';
import { createElement, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import { demoHarness } from './demo-app';
import { RntlDriver } from './rntl-driver';

const clockOpts = { now: wallClock.now, timers: wallTimers };

function nestedHarness(): AppHarness {
  const NestedApp = (): ReactElement =>
    createElement(
      View,
      null,
      createElement(
        View,
        { testID: 'parent-a' },
        createElement(
          Pressable,
          { testID: 'action' },
          createElement(Text, null, 'A')
        )
      ),
      createElement(
        View,
        { testID: 'parent-b' },
        createElement(
          Pressable,
          { testID: 'action' },
          createElement(Text, null, 'B')
        )
      )
    );
  return { createRoot: () => createElement(NestedApp) };
}

describe('RntlDriver', () => {
  let driver: RntlDriver;

  afterEach(async () => {
    await driver?.close();
  });

  it('boots via the RNTL driver and exercises the public API', async () => {
    driver = new RntlDriver({
      harness: demoHarness,
      ...clockOpts,
    });

    await driver.launch();

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

    const html = await driver.snapshotHtml();
    expect(html).toContain('data-testid="home"');
    expect(html).toContain('Welcome ada@example.com');
  });

  it('supports tap on the counter and reports visibility', async () => {
    driver = new RntlDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();

    expect(await driver.get('count').isVisible()).toBe(true);
    expect(await driver.get('missing').isVisible()).toBe(false);

    await driver.get('inc').tap();
    await driver.get('count').expect.text('1');
  });

  it('scopes nested get to the parent subtree', async () => {
    driver = new RntlDriver({ harness: nestedHarness(), ...clockOpts });
    await driver.launch();

    await driver.get('parent-a').get('action').tap();
    expect(await driver.get('parent-a').get('action').text()).toBe('A');

    await driver.get('parent-b').get('action').tap();
    expect(await driver.get('parent-b').get('action').text()).toBe('B');
  });

  it('reports layout from explicit style size', async () => {
    const SizedApp = (): ReactElement =>
      createElement(View, {
        testID: 'board',
        style: { width: 200, height: 200 },
      });
    driver = new RntlDriver({
      harness: { createRoot: () => createElement(SizedApp) },
      ...clockOpts,
    });
    await driver.launch();
    expect(await driver.get('board').layout()).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
  });

  it('synthesizes onLayout when style has no size', async () => {
    let laidOut = 0;
    const MeasuredApp = (): ReactElement =>
      createElement(View, {
        testID: 'board',
        onLayout: () => {
          laidOut += 1;
        },
      });
    driver = new RntlDriver({
      harness: { createRoot: () => createElement(MeasuredApp) },
      ...clockOpts,
    });
    await driver.launch();
    const layout = await driver.get('board').layout();
    expect(layout?.width).toBe(390);
    expect(layout?.height).toBe(390);
    expect(laidOut).toBe(1);
  });

  it('scrolls without throwing', async () => {
    driver = new RntlDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.get('login-scroll').scroll('down', 40);
  });

  it('pressKey does not throw when focus is on an input', async () => {
    driver = new RntlDriver({ harness: demoHarness, ...clockOpts });
    await driver.launch();
    await driver.get('email').tap();
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
        queryWithin: () => null,
        isVisible: () => true,
        getText: () => committed,
        tap: async () => undefined,
        tapAt: async () => undefined,
        drag: async () => undefined,
        layout: async () => null,
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
    await driver.get('label').wait({ text: 'after' }, { timeoutMs: 500 });

    expect(committed).toBe('after');
    expect(activates).toBe(2);
    expect(pumps).toBe(1);
  });
});
