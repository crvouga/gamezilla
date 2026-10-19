import { expect, test } from 'bun:test';
import { expectBoardFacing } from '@libs/runtime-harness/custom-game-journey';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';

/** The shipped board has square buttons but no debug JSON probe. */
function productionBoard(side: 'white' | 'black' | null): Driver {
  const unused = (): never => {
    throw new Error('production board has no debug probe');
  };
  return {
    kind: 'production-board-example',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      tapAt: unused,
      drag: unused,
      selectFile: async () => {},
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      wait: unused,
      isVisible: unused,
      text: unused,
      tap: unused,
      expect: { visible: async () => {}, hidden: unused, text: unused },
      layout: unused,
      attribute: async (name) => {
        if (side === null) return null;
        if (name !== 'style') return unused();
        if (
          ![
            'custom-game-board-square-a1',
            'custom-game-board-square-h8',
          ].includes(id)
        )
          return unused();
        const bottomLeft = id.endsWith('-a1') === (side === 'white');
        return bottomLeft
          ? 'transform: translate(0cqw, 87.5cqw);'
          : 'transform: translate(87.5cqw, 0cqw);';
      },
    }),
  };
}

// regression: live-chess-orientation-needs-debug-probe
test('Bob faces Black on the shipped board without a debug probe', async () => {
  await expect(
    expectBoardFacing('black')(productionBoard('black'))
  ).resolves.toBeUndefined();
});

test('a board facing White cannot satisfy facing Black', async () => {
  await expect(
    expectBoardFacing('black')(productionBoard('white'))
  ).rejects.toThrow('the board does not face black');
});

test('missing square positions cannot satisfy an orientation', async () => {
  await expect(
    expectBoardFacing('black')(productionBoard(null))
  ).rejects.toThrow('board square positions are missing');
});

// regression: live-board-orientation-overlaps-webview-evaluation
test('the shipped board read supports a WebView with one evaluation in flight', async () => {
  const source = productionBoard('black');
  let evaluating = false;
  const ui: Driver = {
    ...source,
    get: (id) => {
      const node = source.get(id);
      return {
        ...node,
        attribute: async (name) => {
          if (evaluating)
            throw new Error('Invalid state: an evaluate() is already pending');
          evaluating = true;
          try {
            await Promise.resolve();
            return await node.attribute(name);
          } finally {
            evaluating = false;
          }
        },
      };
    },
  };
  await expect(expectBoardFacing('black')(ui)).resolves.toBeUndefined();
});
