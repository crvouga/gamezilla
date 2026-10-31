/** @jsxImportSource solid-js */
/**
 * Selecting a navigation item never moves the row: every label box is held
 * at its semibold width, whether or not it is the current item. The wide
 * header's hairline runs the full viewport width.
 */

import { describe, expect, test } from 'bun:test';
import { AppHeaderIsland } from '@pkgs/ui-root-client-ts/app-header-island';
import type { AppHeaderIslandItem } from '@pkgs/ui-root-client-ts/app-header-island-types';
import { HouseIcon, SearchIcon } from '@pkgs/ui-root-client-ts/icons';
import { TabBar, type TabBarItem } from '@pkgs/ui-root-client-ts/tab-bar';
import { createSignal } from 'solid-js';
import { mustQuery, renderUi } from './render';

const WIDE = { width: 1440, height: 900 };
const COMPACT = { width: 390, height: 800 };

/** The label boxes, in item order, as `[class, data-label]`. */
function labelBoxes(root: Element): [string, string | null][] {
  return Array.from(root.querySelectorAll('[data-slot="label"]')).map((el) => [
    el.className,
    el.getAttribute('data-label'),
  ]);
}

function expectReservedWidths(root: Element, labels: readonly string[]): void {
  const boxes = labelBoxes(root);
  expect(boxes.map(([, label]) => label)).toEqual([...labels]);
  for (const [className] of boxes) {
    expect(className).toMatch(/\breserveBold\b/);
  }
  // The box that sets the width is the same for the current item and the rest.
  expect(new Set(boxes.map(([className]) => className)).size).toBe(1);
}

describe('navigation selection keeps the layout still', () => {
  // regression: header-tab-selection-layout-shift
  test('wide header labels reserve the semibold width before and after selection', () => {
    const [current, setCurrent] = createSignal('spaces');
    const item = (id: string, label: string): AppHeaderIslandItem => ({
      id,
      label,
      icon: id === 'spaces' ? HouseIcon : SearchIcon,
      get active() {
        return current() === id;
      },
      onClick: () => setCurrent(id),
    });
    renderUi(
      () => (
        <AppHeaderIsland
          items={[item('spaces', 'Spaces'), item('search', 'Search')]}
        />
      ),
      WIDE
    );
    const nav = mustQuery('nav');
    expectReservedWidths(nav, ['Spaces', 'Search']);
    const before = labelBoxes(nav);
    setCurrent('search');
    expect(labelBoxes(nav)).toEqual(before);
  });

  // regression: header-tab-selection-layout-shift
  test('compact tab bar labels reserve the semibold width before and after selection', () => {
    const [current, setCurrent] = createSignal('home');
    const item = (id: string, label: string): TabBarItem => ({
      id,
      label,
      icon: id === 'home' ? HouseIcon : SearchIcon,
      get current() {
        return current() === id;
      },
      onPress: () => setCurrent(id),
    });
    renderUi(
      () => (
        <TabBar
          aria-label="Main"
          items={[item('home', 'Home'), item('search', 'Search')]}
        />
      ),
      COMPACT
    );
    const nav = mustQuery('nav');
    expectReservedWidths(nav, ['Home', 'Search']);
    const before = labelBoxes(nav);
    setCurrent('search');
    expect(labelBoxes(nav)).toEqual(before);
  });
});
