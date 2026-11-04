/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { floatingActionClearance } from '@pkgs/ui-root-client-ts/floating-action-clearance';
import type { ScreenBasePrimaryAction } from '@pkgs/ui-root-client-ts/screen-base-types';
import { ScreenBodyScrollView } from '@pkgs/ui-root-client-ts/screen-body-scroll-view';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { Show } from 'solid-js';
import { cssOf, renderUi } from './render';

const COMPACT = { width: 390, height: 800 };
const WIDE = { width: 1280, height: 900 };

const CREATE: ScreenBasePrimaryAction = {
  labels: { idle: 'New space' },
  operation: async () => {},
};

const ROWS = Array.from({ length: 30 }, (_, i) => `row-${i}`);

function clearances(): Element[] {
  return Array.from(
    document.querySelectorAll('[data-component="FloatingActionClearance"]')
  );
}

function Lobby(props: {
  readonly primaryAction?: ScreenBasePrimaryAction | undefined;
  readonly list: 'scroll' | 'virtual';
}) {
  return (
    <CollectionScreen
      screenId="clearance"
      breadcrumbs={[{ name: 'Spaces' }]}
      primaryAction={props.primaryAction}
    >
      <Show
        when={props.list === 'scroll'}
        fallback={
          <ScreenBodyVirtualList
            items={ROWS}
            keyExtractor={(row) => row}
            renderItem={(row) => <p class="text">{row}</p>}
            estimateSize={40}
            fixedViewport={{ width: 390, height: 400 }}
          />
        }
      >
        <ScreenBodyScrollView>
          <p class="text">{'last row'}</p>
        </ScreenBodyScrollView>
      </Show>
    </CollectionScreen>
  );
}

describe('a floating action button never covers the last row', () => {
  test('the clearance is the FAB margin, its 52px height and a 16px gap', () => {
    expect(floatingActionClearance(0)).toBe(84);
    expect(floatingActionClearance(56)).toBe(140);
  });

  for (const list of ['scroll', 'virtual'] as const) {
    // regression: ui-fab-covers-last-row
    test(`a ${list} body ends with the FAB's room on a phone`, () => {
      renderUi(() => <Lobby list={list} primaryAction={CREATE} />, COMPACT);
      const [room] = clearances();
      if (room === undefined) throw new Error('no clearance');
      expect(cssOf(room)).toContain('height:84px');
      expect(room).toHaveAttribute('aria-hidden', 'true');
      // It is the scroller's last child, after every row.
      expect(room.nextElementSibling).toBeNull();
    });

    test(`a ${list} body keeps no room when nothing floats`, () => {
      renderUi(() => <Lobby list={list} />, COMPACT);
      expect(clearances()).toHaveLength(0);
    });

    test(`a ${list} body keeps no room on a wide screen`, () => {
      // Wide, the primary action is a header button, not a FAB.
      renderUi(() => <Lobby list={list} primaryAction={CREATE} />, WIDE);
      expect(clearances()).toHaveLength(0);
    });
  }
});
