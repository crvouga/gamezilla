import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { windowGroups } from '@pkgs/ui-devtools-shared-ts/window-layout';
import { createRoot, createSignal } from 'solid-js';
import type { HarnessConsoleNav } from '../src/debugger-chrome';
import {
  HARNESS_LAYOUT_SETTLE_MS,
  type HarnessWindowsSession,
  useHarnessWindows,
} from '../src/use-harness-windows';

function session(): HarnessWindowsSession {
  return {
    revision: 0,
    subscribe: () => () => undefined,
    clients: new Map([
      ['alice', null],
      ['bob', null],
    ]),
    servers: new Map(),
    rooms: new Map(),
    snapshotRestoring: false,
  };
}

/** A host like the app's: every change hands the console a new nav value. */
function mount() {
  return createRoot((dispose) => {
    const [text, setText] = createSignal<string | null>(null);
    const writes: (string | null)[] = [];
    const nav = (): HarnessConsoleNav => ({
      layout: text(),
      panes: {},
      onLayoutChange: (layout) => {
        writes.push(layout);
        setText(layout);
      },
      onPanePatch: () => undefined,
    });
    const { clock, timers } = createHarnessClock();
    const windows = useHarnessWindows(session, nav, timers);
    return { windows, writes, setText, clock, dispose };
  });
}

const tabs = (windows: ReturnType<typeof mount>['windows']) =>
  windowGroups(windows.layout()).map((group) => group.tabs.join(','));

describe('useHarnessWindows', () => {
  test('a rearrangement shows at once, not after the page is read again', () => {
    const { windows, writes, dispose } = mount();
    expect(tabs(windows)[0]).toBe('client:alice');
    windows.arrange('tabs');
    expect(tabs(windows)[0]).toBe('client:alice,client:bob');
    expect(writes).toHaveLength(1);
    dispose();
  });

  test('a focus change shows at once and reaches the host when it settles', () => {
    const { windows, writes, clock, dispose } = mount();
    windows.arrange('beside');
    const second = windowGroups(windows.layout())[1];
    if (second === undefined) throw new Error('no second window');
    const focused = { ...windows.layout(), focused: second.id };
    windows.onLayoutChange(focused, { type: 'focus', window: second.id });
    windows.onLayoutChange(focused, { type: 'focus', window: second.id });
    expect(windows.layout().focused).toBe(second.id);
    expect(windows.focusedPanel()).toBe('client:bob');
    expect(writes).toHaveLength(1);
    clock.advance(HARNESS_LAYOUT_SETTLE_MS);
    expect(writes).toHaveLength(2);
    expect(windows.layout().focused).toBe(second.id);
    dispose();
  });

  test('a layout from the address is not written over by a settling change', () => {
    const { windows, writes, setText, clock, dispose } = mount();
    windows.arrange('tabs');
    const layout = windows.layout();
    const first = windowGroups(layout)[0];
    if (first === undefined) throw new Error('no window');
    windows.onLayoutChange(layout, { type: 'focus', window: first.id });
    setText(null);
    clock.advance(HARNESS_LAYOUT_SETTLE_MS);
    expect(writes).toHaveLength(1);
    expect(tabs(windows)[0]).toBe('client:alice');
    dispose();
  });

  test('windows keep their ids while the host echoes the layout back', () => {
    const { windows, dispose } = mount();
    windows.arrange('tabs');
    const before = windows.layout();
    const first = windowGroups(before)[0];
    if (first === undefined) throw new Error('no window');
    windows.onLayoutChange(before, { type: 'focus', window: first.id });
    expect(windows.layout()).toBe(before);
    dispose();
  });

  test('a layout from the address replaces the one on show', () => {
    const { windows, setText, dispose } = mount();
    windows.arrange('tabs');
    setText(null);
    expect(tabs(windows)[0]).toBe('client:alice');
    dispose();
  });
});
