/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { WindowManager } from '@pkgs/ui-devtools-client-ts/window-manager';
import type { WindowPanel } from '@pkgs/ui-devtools-client-ts/window-manager-types';
import {
  createWindowLayout,
  type WindowLayout,
  type WindowLayoutCommand,
  type WindowLayoutSpec,
  windowGroups,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { parseWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

function mustAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
}

const WIDTH = 1000;
const HEIGHT = 600;

function mount(
  spec: WindowLayoutSpec,
  options: { readonly compact?: boolean; readonly ids?: readonly string[] } = {}
) {
  const mounts: Record<string, number> = {};
  const panels: WindowPanel[] = (options.ids ?? ['a', 'b', 'c', 'd']).map(
    (id) => ({
      id,
      title: `Panel ${id.toUpperCase()}`,
      closable: id !== 'd',
      content: () => {
        mounts[id] = (mounts[id] ?? 0) + 1;
        return <input aria-label={`Field ${id}`} />;
      },
    })
  );
  const [layout, setLayout] = createSignal<WindowLayout>(
    createWindowLayout(spec)
  );
  const commands: WindowLayoutCommand[] = [];
  renderUi(() => (
    <OverlayPortalProvider>
      <SurfaceStackProvider>
        <WindowManager
          aria-label="Workspace"
          panels={panels}
          layout={layout()}
          compact={options.compact}
          onLayoutChange={(next, command) => {
            commands.push(command);
            setLayout(next);
          }}
        />
      </SurfaceStackProvider>
    </OverlayPortalProvider>
  ));
  const root = screen.getByRole('group', { name: 'Workspace' });
  root.getBoundingClientRect = () => new DOMRect(0, 0, WIDTH, HEIGHT);
  return { layout, commands, mounts, root };
}

function part(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`missing ${selector}`);
  return element;
}

const tab = (id: string): HTMLElement =>
  part(`[data-window-part="tab"][data-panel-id="${id}"]`);
const panel = (id: string): HTMLElement =>
  part(`[data-window-part="panel"][data-panel-id="${id}"]`);
const tabsOf = (layout: WindowLayout): readonly (readonly string[])[] =>
  windowGroups(layout).map((group) => group.tabs);

function drag(id: string, to: { readonly x: number; readonly y: number }) {
  const shell = tab(id).parentElement;
  if (shell === null) throw new Error('tab has no shell');
  const at = { pointerId: 1, button: 0 };
  fireEvent.pointerDown(shell, { ...at, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(shell, { ...at, clientX: to.x, clientY: to.y });
  return {
    shell,
    drop: () =>
      fireEvent.pointerUp(shell, { ...at, clientX: to.x, clientY: to.y }),
  };
}

describe('WindowManager', () => {
  test('windows are labelled groups with a tab bar and one visible panel each', () => {
    const { root } = mount({ direction: 'row', children: [['a', 'b'], ['c']] });
    const first = screen.getByRole('group', {
      name: 'Window 1 of 2: Panel A',
    });
    expect(first).toHaveAttribute('aria-owns', panel('a').id);
    expect(
      screen.getByRole('tablist', { name: 'Tabs of window 1' })
    ).toHaveAttribute('aria-owns', `${tab('a').id} ${tab('b').id}`);
    expect(tab('a')).toHaveAttribute('aria-selected', 'true');
    expect(tab('a')).toHaveAttribute('aria-controls', panel('a').id);
    expect(tab('b')).toHaveAttribute('tabindex', '-1');
    expect(panel('a')).toHaveAttribute('role', 'tabpanel');
    expect(panel('a')).toHaveAttribute('aria-labelledby', tab('a').id);
    expect(panel('a')).toHaveAttribute('data-panel-visible', 'true');
    expect(panel('b')).toHaveAttribute('data-panel-visible', 'false');
    expect(panel('c')).toHaveAttribute('data-panel-visible', 'true');
    expect(document.querySelector('[data-panel-id="d"]')).toBeNull();
    expect(
      parseWindowLayout(root.getAttribute('data-layout') ?? '')
    ).not.toBeNull();
  });

  test('clicking a tab shows its panel without remounting any panel', () => {
    const { mounts, layout } = mount([['a', 'b', 'c']].flat());
    const before = panel('a');
    fireEvent.click(tab('b'));
    expect(tab('b')).toHaveAttribute('aria-selected', 'true');
    expect(panel('b')).toHaveAttribute('data-panel-visible', 'true');
    expect(panel('a')).toBe(before);
    fireEvent.keyDown(tab('b'), {
      key: 'ArrowRight',
      altKey: true,
      shiftKey: true,
    });
    expect(tabsOf(layout())).toEqual([['a', 'c'], ['b']]);
    expect(panel('a')).toBe(before);
    expect(mounts).toEqual({ a: 1, b: 1, c: 1 });
  });

  test('arrow keys switch, reorder, cross windows and move panels; focus follows', () => {
    const { layout } = mount({
      direction: 'row',
      children: [['a', 'b'], ['c']],
    });
    tab('a').focus();
    fireEvent.keyDown(tab('a'), { key: 'ArrowRight' });
    expect(tab('b')).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tab('b'));
    fireEvent.keyDown(tab('b'), { key: 'ArrowLeft', shiftKey: true });
    expect(tabsOf(layout())).toEqual([['b', 'a'], ['c']]);
    fireEvent.keyDown(tab('b'), { key: 'ArrowRight', altKey: true });
    expect(document.activeElement).toBe(tab('c'));
    expect(part('[data-window-focused="true"]')).toHaveAttribute(
      'data-active-panel',
      'c'
    );
    fireEvent.keyDown(tab('c'), {
      key: 'ArrowLeft',
      altKey: true,
      shiftKey: true,
    });
    expect(tabsOf(layout())).toEqual([['b', 'a', 'c']]);
    expect(document.activeElement).toBe(tab('c'));
    expect(screen.getByRole('status')).toHaveTextContent('Panel C moved');
  });

  test('Delete closes a panel, the open menu brings it back, unclosable panels stay', () => {
    const { layout, mounts } = mount(['a', 'b', 'd']);
    tab('a').focus();
    fireEvent.keyDown(tab('a'), { key: 'Delete' });
    expect(tabsOf(layout())).toEqual([['b', 'd']]);
    expect(
      document.querySelector('[data-window-part="panel"][data-panel-id="a"]')
    ).toBeNull();
    expect(document.activeElement).toBe(tab('b'));
    expect(screen.getByRole('status')).toHaveTextContent('Panel A closed');
    fireEvent.keyDown(tab('d'), { key: 'Delete' });
    expect(tabsOf(layout())).toEqual([['b', 'd']]);
    expect(
      document.querySelector('[data-window-part="close"][data-panel-id="d"]')
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open a panel' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Panel A' }));
    expect(tabsOf(layout())).toEqual([['b', 'd', 'a']]);
    expect(mounts['a']).toBe(2);
  });

  test('the window menu splits, moves, maximizes and restores', () => {
    const { layout } = mount(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: 'Window actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Split right' }));
    expect(tabsOf(layout())).toEqual([['b'], ['a']]);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    const maximize = screen.getAllByRole('button', { name: 'Maximize window' });
    fireEvent.click(mustAt(maximize, 0));
    expect(layout().maximized).not.toBeNull();
    expect(screen.queryAllByRole('separator')).toHaveLength(0);
    expect(screen.getByRole('group', { name: /^Window 1 of 1/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restore windows' }));
    expect(layout().maximized).toBeNull();
  });

  test('a divider is a window splitter the arrows resize', () => {
    const { commands } = mount({ direction: 'row', children: [['a'], ['b']] });
    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-valuenow', '50');
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '60'
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'End' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '90'
    );
    fireEvent.keyDown(screen.getByRole('separator'), { key: 'Enter' });
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
    expect(commands.map((command) => command.type)).toEqual([
      'resize',
      'resize',
      'equalize',
    ]);
  });

  test('dragging a tab to a window edge previews and makes a split', () => {
    const { layout, root } = mount({
      direction: 'row',
      children: [['a', 'b'], ['c']],
    });
    const gesture = drag('a', { x: 990, y: 300 });
    expect(root).toHaveAttribute('data-dragging', 'true');
    expect(part('[data-window-part="drop-preview"]')).toHaveAttribute(
      'data-drop-zone',
      'right'
    );
    expect(part('[data-window-part="drag-ghost"]')).toHaveTextContent(
      'Panel A'
    );
    gesture.drop();
    expect(root).toHaveAttribute('data-dragging', 'false');
    expect(tabsOf(layout())).toEqual([['b'], ['c'], ['a']]);
    fireEvent.click(tab('a'));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Panel A moved to a new window on the right'
    );
  });

  test('dragging a tab onto another tab bar or window body joins its tabs', () => {
    const { layout } = mount({
      direction: 'row',
      children: [['a', 'b'], ['c']],
    });
    drag('a', { x: 750, y: 10 }).drop();
    expect(tabsOf(layout())).toEqual([['b'], ['c', 'a']]);
    drag('b', { x: 750, y: 300 }).drop();
    expect(tabsOf(layout())).toEqual([['c', 'a', 'b']]);
  });

  test('a pointer that leaves the tab in one move still drags it', () => {
    const { layout, root } = mount({
      direction: 'row',
      children: [['a', 'b'], ['c']],
    });
    const shell = tab('a').parentElement;
    if (shell === null) throw new Error('tab has no shell');
    const at = { pointerId: 1, button: 0, clientX: 990, clientY: 300 };
    fireEvent.pointerDown(shell, { ...at, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(panel('c'), at);
    expect(root).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerUp(panel('c'), at);
    expect(tabsOf(layout())).toEqual([['b'], ['c'], ['a']]);
    fireEvent.pointerMove(panel('c'), { ...at, clientX: 100 });
    expect(root).toHaveAttribute('data-dragging', 'false');
  });

  test('Escape cancels a drag and a short press is still a click', () => {
    const { layout, root } = mount({
      direction: 'row',
      children: [['a', 'b'], ['c']],
    });
    const gesture = drag('a', { x: 990, y: 300 });
    fireEvent.keyDown(tab('a'), { key: 'Escape' });
    expect(root).toHaveAttribute('data-dragging', 'false');
    gesture.drop();
    expect(tabsOf(layout())).toEqual([['a', 'b'], ['c']]);
    drag('b', { x: 22, y: 21 }).drop();
    expect(tabsOf(layout())).toEqual([['a', 'b'], ['c']]);
    fireEvent.click(tab('b'));
    expect(tab('b')).toHaveAttribute('aria-selected', 'true');
  });

  test('Down Arrow enters the panel and using a panel focuses its window', () => {
    const { layout } = mount({ direction: 'row', children: [['a'], ['c']] });
    fireEvent.keyDown(tab('a'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(panel('a'));
    const before = layout().focused;
    fireEvent.pointerDown(panel('c'));
    expect(layout().focused).not.toBe(before);
  });

  test('compact shows one window with every panel in a single tab bar', () => {
    const { layout } = mount(
      { direction: 'row', children: [['a', 'b'], ['c']] },
      { compact: true }
    );
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.queryAllByRole('separator')).toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: 'Maximize window' })
    ).toBeNull();
    fireEvent.click(tab('c'));
    expect(panel('c')).toHaveAttribute('data-panel-visible', 'true');
    expect(panel('a')).toHaveAttribute('data-panel-visible', 'false');
    fireEvent.keyDown(tab('c'), { key: 'ArrowRight' });
    expect(tab('a')).toHaveAttribute('aria-selected', 'true');
    drag('a', { x: 990, y: 300 }).drop();
    expect(tabsOf(layout())).toEqual([['a', 'b'], ['c']]);
  });

  test('with every panel closed, the empty state reopens them', () => {
    const { layout } = mount(['a'], { ids: ['a', 'b'] });
    fireEvent.keyDown(tab('a'), { key: 'Delete' });
    expect(screen.getByText('No panels are open')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Panel B' }));
    expect(tabsOf(layout())).toEqual([['b']]);
    expect(document.activeElement).toBe(tab('b'));
  });
});
