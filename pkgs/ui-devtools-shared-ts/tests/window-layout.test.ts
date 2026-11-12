import { describe, expect, test } from 'bun:test';
import {
  applyWindowLayoutCommand,
  createWindowLayout,
  pruneWindowLayout,
  type WindowLayout,
  type WindowLayoutCommand,
  windowGroups,
  windowOfPanel,
  windowPanels,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import {
  parseWindowLayout,
  serializeWindowLayout,
} from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import {
  windowDropCommand,
  windowDropTarget,
  windowFrames,
  windowNeighbor,
} from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';

function run(
  layout: WindowLayout,
  ...commands: readonly WindowLayoutCommand[]
): WindowLayout {
  return commands.reduce(applyWindowLayoutCommand, layout);
}

/** `w1[a*,b] | w2[c*]` — windows in reading order, `*` on the visible tab. */
function shape(layout: WindowLayout): string {
  return windowGroups(layout)
    .map(
      (group) =>
        `${group.id}[${group.tabs
          .map((tab) => (tab === group.active ? `${tab}*` : tab))
          .join(',')}]`
    )
    .join(' | ');
}

const TWO = createWindowLayout({
  direction: 'row',
  children: [['a', 'b'], ['c']],
});

describe('createWindowLayout', () => {
  test('numbers windows in reading order and focuses the first', () => {
    expect(shape(TWO)).toBe('w1[a*,b] | w2[c*]');
    expect(TWO.focused).toBe('w1');
    expect(TWO.maximized).toBeNull();
  });

  test('drops empty windows, repeated panels and one-child splits', () => {
    const layout = createWindowLayout({
      direction: 'row',
      children: [['a', 'a'], [], { direction: 'column', children: [['a']] }],
    });
    expect(layout.root).toEqual({
      type: 'window',
      id: 'w1',
      tabs: ['a'],
      active: 'a',
    });
  });

  test('a split nested in a split of its direction joins it, keeping shares', () => {
    const layout = createWindowLayout({
      direction: 'row',
      children: [['a'], { direction: 'row', children: [['b'], ['c']] }],
    });
    expect(layout.root).toMatchObject({
      type: 'split',
      direction: 'row',
      sizes: [1, 0.5, 0.5],
    });
  });
});

describe('tabs', () => {
  test('select shows a panel and focuses its window', () => {
    const next = run(TWO, { type: 'select', panel: 'c' });
    expect(next.focused).toBe('w2');
    expect(shape(run(next, { type: 'select', panel: 'b' }))).toBe(
      'w1[a,b*] | w2[c*]'
    );
  });

  test('move puts a panel in another tab bar at an index', () => {
    const next = run(TWO, { type: 'move', panel: 'c', window: 'w1', index: 1 });
    expect(shape(next)).toBe('w1[a,c*,b]');
    expect(next.root?.type).toBe('window');
  });

  test('move within a window reorders its tabs', () => {
    expect(
      shape(run(TWO, { type: 'move', panel: 'a', window: 'w1', index: 1 }))
    ).toBe('w1[a*,b] | w2[c*]'.replace('a*,b', 'b,a*'));
  });

  test('close shows the neighbouring tab and removes an emptied window', () => {
    expect(shape(run(TWO, { type: 'close', panel: 'a' }))).toBe(
      'w1[b*] | w2[c*]'
    );
    const emptied = run(
      TWO,
      { type: 'select', panel: 'c' },
      { type: 'close', panel: 'c' }
    );
    expect(shape(emptied)).toBe('w1[a*,b]');
    expect(emptied.focused).toBe('w1');
  });

  test('open selects an open panel and adds a closed one to the focused window', () => {
    expect(shape(run(TWO, { type: 'open', panel: 'b' }))).toBe(
      'w1[a,b*] | w2[c*]'
    );
    expect(
      shape(
        run(TWO, { type: 'focus', window: 'w2' }, { type: 'open', panel: 'd' })
      )
    ).toBe('w1[a*,b] | w2[c,d*]');
    expect(
      shape(run(createWindowLayout([]), { type: 'open', panel: 'x' }))
    ).toBe('w1[x*]');
  });
});

describe('split', () => {
  test('puts the panel in a new window on the named edge', () => {
    const next = run(TWO, {
      type: 'split',
      panel: 'b',
      window: 'w1',
      edge: 'bottom',
    });
    expect(shape(next)).toBe('w1[a*] | w3[b*] | w2[c*]');
    expect(next.focused).toBe('w3');
    expect(next.root).toMatchObject({
      direction: 'row',
      children: [{ type: 'split', direction: 'column' }, { id: 'w2' }],
    });
  });

  test('a split along the parent direction shares the split window share', () => {
    const next = run(TWO, {
      type: 'split',
      panel: 'b',
      window: 'w2',
      edge: 'left',
    });
    expect(shape(next)).toBe('w1[a*] | w3[b*] | w2[c*]');
    expect(next.root).toMatchObject({ direction: 'row', sizes: [1, 0.5, 0.5] });
  });

  test('a window is not split by its only panel', () => {
    expect(
      run(TWO, { type: 'split', panel: 'c', window: 'w2', edge: 'right' })
    ).toEqual(run(TWO, { type: 'select', panel: 'c' }));
  });
});

describe('sizes and maximize', () => {
  test('resize moves a divider and stops at the minimum share', () => {
    const next = run(TWO, {
      type: 'resize',
      split: 's1',
      index: 0,
      delta: 0.2,
    });
    expect(windowFrames(next).windows[0]?.rect.width).toBeCloseTo(0.7);
    const pinned = run(next, {
      type: 'resize',
      split: 's1',
      index: 0,
      delta: 5,
    });
    expect(windowFrames(pinned).windows[0]?.rect.width).toBeCloseTo(0.9);
    expect(
      windowFrames(run(pinned, { type: 'equalize' })).windows[0]?.rect.width
    ).toBeCloseTo(0.5);
  });

  test('a maximized window is the only frame and follows the selection', () => {
    const max = run(TWO, { type: 'maximize', window: 'w2' });
    expect(windowFrames(max)).toEqual({
      windows: [{ id: 'w2', rect: { left: 0, top: 0, width: 1, height: 1 } }],
      separators: [],
    });
    expect(run(max, { type: 'select', panel: 'a' }).maximized).toBe('w1');
    expect(run(max, { type: 'restore' }).maximized).toBeNull();
    expect(run(max, { type: 'close', panel: 'c' }).maximized).toBeNull();
  });

  test('commands that name nothing change nothing', () => {
    for (const command of [
      { type: 'select', panel: 'zz' },
      { type: 'focus', window: 'zz' },
      { type: 'move', panel: 'a', window: 'zz' },
      { type: 'split', panel: 'a', window: 'zz', edge: 'left' },
      { type: 'close', panel: 'zz' },
      { type: 'resize', split: 'zz', index: 0, delta: 0.1 },
      { type: 'maximize', window: 'zz' },
    ] as const)
      expect(run(TWO, command)).toEqual(TWO);
  });
});

describe('geometry', () => {
  const grid = createWindowLayout({
    direction: 'row',
    children: [['a'], { direction: 'column', children: [['b'], ['c']] }],
  });

  test('frames tile the area and dividers sit between them', () => {
    const frames = windowFrames(grid);
    expect(frames.windows.map((frame) => frame.rect)).toEqual([
      { left: 0, top: 0, width: 0.5, height: 1 },
      { left: 0.5, top: 0, width: 0.5, height: 0.5 },
      { left: 0.5, top: 0.5, width: 0.5, height: 0.5 },
    ]);
    expect(frames.separators).toEqual([
      {
        split: 's1',
        index: 0,
        direction: 'row',
        rect: { left: 0.5, top: 0, width: 0, height: 1 },
        extent: 1,
        value: 50,
        min: 10,
        max: 90,
      },
      {
        split: 's2',
        index: 0,
        direction: 'column',
        rect: { left: 0.5, top: 0.5, width: 0.5, height: 0 },
        extent: 1,
        value: 50,
        min: 10,
        max: 90,
      },
    ]);
  });

  test('neighbours are the windows across an edge', () => {
    expect(windowNeighbor(grid, 'w1', 'right')).toBe('w2');
    expect(windowNeighbor(grid, 'w2', 'left')).toBe('w1');
    expect(windowNeighbor(grid, 'w2', 'bottom')).toBe('w3');
    expect(windowNeighbor(grid, 'w3', 'top')).toBe('w2');
    expect(windowNeighbor(grid, 'w1', 'left')).toBeNull();
    expect(windowNeighbor(grid, 'w3', 'bottom')).toBeNull();
  });

  test('a drop lands on the tab bar, an edge or the middle of a window', () => {
    const frames = windowFrames(grid).windows;
    const at = (x: number, y: number) =>
      windowDropTarget({ frames, point: { x, y }, tabBarHeight: 0.05 });
    expect(at(0.25, 0.02)).toMatchObject({ window: 'w1', zone: 'tabs' });
    expect(at(0.25, 0.5)).toMatchObject({ window: 'w1', zone: 'center' });
    expect(at(0.02, 0.5)).toEqual({
      window: 'w1',
      zone: 'left',
      rect: { left: 0, top: 0, width: 0.25, height: 1 },
    });
    expect(at(0.98, 0.2)).toMatchObject({ window: 'w2', zone: 'right' });
    expect(at(0.75, 0.98)).toMatchObject({ window: 'w3', zone: 'bottom' });
    expect(at(0.75, 0.57)).toMatchObject({ window: 'w3', zone: 'top' });
    expect(at(1.2, 0.5)).toBeNull();
    const drop = (x: number, y: number, index?: number) => {
      const target = at(x, y);
      if (target === null) throw new Error('no target');
      return windowDropCommand('a', target, index);
    };
    expect(drop(0.75, 0.02, 1)).toEqual({
      type: 'move',
      panel: 'a',
      window: 'w2',
      index: 1,
    });
    expect(drop(0.75, 0.25)).toEqual({
      type: 'move',
      panel: 'a',
      window: 'w2',
    });
    expect(drop(0.75, 0.98)).toEqual({
      type: 'split',
      panel: 'a',
      window: 'w3',
      edge: 'bottom',
    });
  });
});

describe('prune and codec', () => {
  test('prune closes the panels the caller no longer has', () => {
    expect(shape(pruneWindowLayout(TWO, ['a', 'c', 'new']))).toBe(
      'w1[a*] | w2[c*]'
    );
    expect(pruneWindowLayout(TWO, ['a', 'b', 'c'])).toBe(TWO);
  });

  test('a layout survives the trip through its text', () => {
    const layout = run(
      TWO,
      { type: 'select', panel: 'b' },
      { type: 'resize', split: 's1', index: 0, delta: 0.25 },
      { type: 'maximize', window: 'w2' }
    );
    const text = serializeWindowLayout(layout);
    expect(text).toBe(
      '{"r":{"d":"r","c":[{"t":["a","b"],"a":1},{"t":["c"]}],"s":[1.5,0.5]},"f":"c","m":true}'
    );
    expect(parseWindowLayout(text)).toEqual(layout);
  });

  test('text that is not a layout parses to null; unknown shapes never throw', () => {
    for (const text of ['', 'nope', '[]', '{"r":5}', '{"r":{"d":"x","c":[]}}'])
      expect(parseWindowLayout(text)).toBeNull();
    expect(parseWindowLayout('{"r":null}')).toEqual(createWindowLayout([]));
    expect(
      windowPanels(parseWindowLayout('{"r":{"t":["a"],"a":9}}') ?? TWO)
    ).toEqual(['a']);
    expect(windowOfPanel(TWO, 'zz')).toBeNull();
  });
});
