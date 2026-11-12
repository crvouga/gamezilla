import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  applyWindowLayoutCommand,
  createWindowLayout,
  WINDOW_EDGES,
  type WindowLayout,
  type WindowLayoutCommand,
  type WindowLayoutSpec,
  windowGroups,
  windowPanels,
  windowSplits,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import {
  parseWindowLayout,
  serializeWindowLayout,
} from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import {
  windowDropTarget,
  windowFrames,
} from '@pkgs/ui-devtools-shared-ts/window-layout-geometry';
import fc from 'fast-check';

const PANELS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
const panel = fc.constantFrom(...PANELS);
const node = fc.constantFrom('w1', 'w2', 'w3', 'w4', 's1', 's2', 's3', 'zz');

const spec: fc.Arbitrary<WindowLayoutSpec> = fc.letrec<{
  node: WindowLayoutSpec;
}>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', maxDepth: 3 },
    fc.array(panel, { maxLength: 3 }),
    fc.record({
      direction: fc.constantFrom('row' as const, 'column' as const),
      children: fc.array(tie('node'), { maxLength: 3 }),
      sizes: fc.array(fc.double({ min: 0.2, max: 4, noNaN: true }), {
        maxLength: 3,
      }),
    })
  ),
})).node;

const command: fc.Arbitrary<WindowLayoutCommand> = fc.oneof(
  fc.record({ type: fc.constant('select' as const), panel }),
  fc.record({ type: fc.constant('focus' as const), window: node }),
  fc.record({
    type: fc.constant('move' as const),
    panel,
    window: node,
    index: fc.option(fc.integer({ min: -1, max: 5 }), { nil: undefined }),
  }),
  fc.record({
    type: fc.constant('split' as const),
    panel,
    window: node,
    edge: fc.constantFrom(...WINDOW_EDGES),
  }),
  fc.record({ type: fc.constant('open' as const), panel }),
  fc.record({ type: fc.constant('close' as const), panel }),
  fc.record({
    type: fc.constant('resize' as const),
    split: node,
    index: fc.integer({ min: -1, max: 3 }),
    delta: fc.double({ min: -2, max: 2, noNaN: true }),
  }),
  fc.record({
    type: fc.constant('equalize' as const),
    split: fc.option(node, { nil: undefined }),
  }),
  fc.record({ type: fc.constant('maximize' as const), window: node }),
  fc.record({ type: fc.constant('restore' as const) })
);

function expectCanonical(layout: WindowLayout): void {
  const groups = windowGroups(layout);
  const ids = [...groups, ...windowSplits(layout)].map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  const panels = windowPanels(layout);
  expect(new Set(panels).size).toBe(panels.length);
  for (const group of groups) expect(group.tabs).toContain(group.active);
  for (const split of windowSplits(layout)) {
    expect(split.children.length).toBeGreaterThan(1);
    expect(split.sizes).toHaveLength(split.children.length);
    for (const size of split.sizes) expect(size).toBeGreaterThan(0);
    for (const child of split.children)
      expect(child.type === 'split' && child.direction).not.toBe(
        split.direction
      );
  }
  const windowIds = groups.map((group) => group.id);
  expect(layout.root === null).toBe(groups.length === 0);
  expect(layout.focused === null).toBe(groups.length === 0);
  if (layout.focused !== null) expect(windowIds).toContain(layout.focused);
  expect([null, layout.focused]).toContain(layout.maximized);
}

function expectTiled(layout: WindowLayout): void {
  const frames = windowFrames({ ...layout, maximized: null }).windows;
  if (frames.length === 0) return;
  const area = frames.reduce(
    (total, frame) => total + frame.rect.width * frame.rect.height,
    0
  );
  expect(area).toBeCloseTo(1, 6);
  for (const frame of frames) {
    const middle = {
      x: frame.rect.left + frame.rect.width / 2,
      y: frame.rect.top + frame.rect.height / 2,
    };
    expect(
      windowDropTarget({ frames, point: middle, tabBarHeight: 0 })?.window
    ).toBe(frame.id);
  }
}

/** What a command may do to the set of open panels. */
function expectPanelsFollow(
  before: WindowLayout,
  after: WindowLayout,
  step: WindowLayoutCommand
): void {
  const was = [...windowPanels(before)].sort();
  const now = [...windowPanels(after)].sort();
  if (step.type === 'close')
    expect(now).toEqual(was.filter((item) => item !== step.panel));
  else if (step.type === 'open')
    expect(now).toEqual([...new Set([...was, step.panel])].sort());
  else if (step.type === 'move' || step.type === 'split')
    expect(now.filter((item) => item !== step.panel)).toEqual(
      was.filter((item) => item !== step.panel)
    );
  else expect(now).toEqual(was);
}

test('every command leaves a canonical layout that tiles its area', () => {
  assertProperty(
    'window layout stays canonical',
    fc.property(spec, fc.array(command, { maxLength: 25 }), (start, steps) => {
      let layout = createWindowLayout(start);
      expectCanonical(layout);
      for (const step of steps) {
        const next = applyWindowLayoutCommand(layout, step);
        expectCanonical(next);
        expectTiled(next);
        expectPanelsFollow(layout, next, step);
        layout = next;
      }
    })
  );
});

test('a moved, split or opened panel is shown in the focused window', () => {
  assertProperty(
    'placing a panel shows it',
    fc.property(spec, fc.array(command, { maxLength: 12 }), (start, steps) => {
      let layout = createWindowLayout(start);
      for (const step of steps) {
        const before = layout;
        layout = applyWindowLayoutCommand(layout, step);
        const placed =
          step.type === 'open' ||
          ((step.type === 'move' || step.type === 'split') &&
            windowGroups(before).some((group) => group.id === step.window));
        if (!placed) continue;
        const focused = windowGroups(layout).find(
          (group) => group.id === layout.focused
        );
        expect(focused?.active).toBe(step.panel);
      }
    })
  );
});

test('the text of a layout parses back to the same text', () => {
  assertProperty(
    'window layout codec round trip',
    fc.property(spec, fc.array(command, { maxLength: 12 }), (start, steps) => {
      const layout = steps.reduce(
        applyWindowLayoutCommand,
        createWindowLayout(start)
      );
      const text = serializeWindowLayout(layout);
      const parsed = parseWindowLayout(text);
      if (parsed === null) throw new Error(`did not parse: ${text}`);
      expectCanonical(parsed);
      expect(serializeWindowLayout(parsed)).toBe(text);
      expect(windowGroups(parsed).map((group) => group.tabs)).toEqual(
        windowGroups(layout).map((group) => group.tabs)
      );
    })
  );
});
