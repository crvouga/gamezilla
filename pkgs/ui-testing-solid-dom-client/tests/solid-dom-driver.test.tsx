/** @jsxImportSource solid-js */

import { afterEach, describe, expect, test } from 'bun:test';
import { TimeoutError } from '@pkgs/ui-testing-root-shared/timeout-error';
import { UiTestError } from '@pkgs/ui-testing-root-shared/ui-test-error';
import type { SolidDomDriver } from '@pkgs/ui-testing-solid-dom-client/solid-dom-driver';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client/solid-dom-driver';
import { isBlankSnapshotHtml } from '@pkgs/ui-testing-solid-dom-shared/serialize-dom-html';
import { createSignal, type JSX, onMount } from 'solid-js';
import { createDemoClock, DemoApp, DemoProviders } from './demo-app';

function demoDriver(): SolidDomDriver {
  const harness = createDemoClock();
  return createSolidDomDriver({
    clock: harness.clock,
    pump: harness.pump,
    harness: { createRoot: () => () => <DemoApp harness={harness} /> },
  });
}

/** The error `promise` rejects with; fails if it resolves. */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (error: unknown) => error
  );
}

function customDriver(root: () => JSX.Element): SolidDomDriver {
  const harness = createDemoClock();
  return createSolidDomDriver({
    clock: harness.clock,
    pump: harness.pump,
    harness: {
      createRoot: () => () => (
        <DemoProviders harness={harness}>{root()}</DemoProviders>
      ),
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
    expect(await driver.get('count').attribute('data-testid')).toBe('count');
    expect(await driver.get('count').attribute('data-missing')).toBeNull();
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
        <div class="box" data-testid="parent-a">
          <p class="text" data-testid="label">
            {'A'}
          </p>
        </div>
        <div class="box" data-testid="parent-b">
          <p class="text" data-testid="label">
            {'B'}
          </p>
        </div>
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

  test('layout dispatches ELEMENT_LAYOUT_EVENT so size listeners remeasure', async () => {
    const sizes: number[] = [];
    driver = customDriver(() => {
      let host: HTMLElement | undefined;
      onMount(() => {
        host?.addEventListener('ui-testing:element-layout', () => {
          if (host === undefined) return;
          sizes.push(host.getBoundingClientRect().width);
        });
      });
      return (
        <div
          class="box w-full h-full"
          data-testid="frame"
          ref={(el) => {
            host = el;
          }}
        />
      );
    });
    await driver.launch();
    const frameLayout = await driver.get('frame').layout();
    expect(frameLayout).toMatchObject({ width: 390 });
    expect(frameLayout?.height).toBeGreaterThanOrEqual(390);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes[sizes.length - 1]).toBe(390);
  });

  test('observing an application measures its controls before any gesture', async () => {
    // regression: solid-dom-observation-leaves-board-unmeasured
    driver = customDriver(() => {
      const [width, setWidth] = createSignal(0);
      let host: HTMLElement | undefined;
      onMount(() => {
        host?.addEventListener('ui-testing:element-layout', () => {
          setWidth(host?.getBoundingClientRect().width ?? 0);
        });
      });
      return (
        <div
          class="box w-full"
          ref={(element) => {
            host = element;
          }}
        >
          <span data-testid="measured-width">{width()}</span>
        </div>
      );
    });
    await driver.launch();
    expect(await driver.get('measured-width').text()).toBe('390');
  });

  test('layout synthesizes a box from inline size and tapAt/drag hit it', async () => {
    const points: string[] = [];
    driver = customDriver(() => (
      <div
        class="box"
        data-testid="board"
        style={{ width: '200px', height: '100px' }}
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

  test('secondary tapAt / drag press button 2 and open the context menu', async () => {
    const events: string[] = [];
    const log = (e: MouseEvent) =>
      events.push(`${e.type}:${e.button}:${e.clientX},${e.clientY}`);
    driver = customDriver(() => (
      <div
        class="box"
        data-testid="board"
        style={{ width: '200px', height: '100px' }}
        onPointerDown={log}
        onPointerUp={log}
        ref={(el) => el.addEventListener('contextmenu', log)}
      />
    ));
    await driver.launch();
    await driver
      .get('board')
      .tapAt({ xRatio: 0.5, yRatio: 0.5 }, { button: 'secondary' });
    await driver
      .get('board')
      .drag(
        { xRatio: 0, yRatio: 0 },
        { xRatio: 1, yRatio: 1 },
        { button: 'secondary' }
      );
    expect(events).toEqual([
      'pointerdown:2:100,50',
      'contextmenu:2:100,50',
      'pointerup:2:100,50',
      'pointerdown:2:0,0',
      'contextmenu:2:0,0',
      'pointerup:2:200,100',
    ]);
  });

  test('wait(text) observes async updates driven by the pump', async () => {
    const [label, setLabel] = createSignal('before');
    const harness = createDemoClock();
    driver = createSolidDomDriver({
      clock: harness.clock,
      pump: harness.pump,
      harness: {
        createRoot: () => () => (
          <DemoProviders harness={harness}>
            <p class="text" data-testid="label">
              {label()}
            </p>
          </DemoProviders>
        ),
      },
    });
    await driver.launch();
    harness.timers.setTimeout(() => setLabel('after'), 5);
    await driver.get('label').wait({ text: 'after' }, { timeoutMs: 500 });
    expect(await driver.get('label').text()).toBe('after');
  });

  test('wait times out with TimeoutError / UiTestError on the injected clock', async () => {
    driver = demoDriver();
    await driver.launch();
    const waitError = await rejection(
      driver.get('missing').wait('visible', { timeoutMs: 50 })
    );
    expect(waitError).toBeInstanceOf(TimeoutError);
    expect((waitError as Error).message).toContain(
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
    const closedError = await rejection(driver.get('email').isVisible());
    expect((closedError as Error).message).toContain('Driver not launched');
  });
});
