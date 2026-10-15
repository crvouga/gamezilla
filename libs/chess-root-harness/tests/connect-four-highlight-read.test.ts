import { expect, test } from 'bun:test';
import { connectFourView } from '@libs/connect-four-harness/connect-four-actions';
import type { ProductHarness } from '@libs/harness/harness';

// regression: connect-four-highlight-counts-stylesheet
test('the winning alignment read counts highlighted cells without counting CSS', async () => {
  const winning = new Set([0, 7, 14, 21]);
  const ui = {
    get: (id: string) => ({
      layout: async () => null,
      text: async () =>
        JSON.stringify({ current: {}, displayFen: 'c4:1:0101010' }),
      attribute: async (name: string) => {
        if (name === 'data-winning')
          return String(
            winning.has(Number(id.replace('connect-four-board-cell-', '')))
          );
        if (name === 'data-cells') return '[]';
        return null;
      },
    }),
    snapshotHtml: async () =>
      '<style>.cell[data-winning="true"] { outline: solid; }</style>' +
      [...winning].map(() => '<span data-winning="true"></span>').join(''),
  };
  const harness = {
    actors: new Map([['alice', { ui }]]),
  } as unknown as ProductHarness;
  expect((await connectFourView(harness)).winningShown).toBe(4);
});
