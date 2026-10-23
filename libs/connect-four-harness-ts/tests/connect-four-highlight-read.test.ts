import { expect, test } from 'bun:test';
import { connectFourView } from '@libs/connect-four-harness-ts/connect-four-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';

// regression: connect-four-highlight-counts-stylesheet
// regression: connect-four-highlight-overlaps-browser-reads
test('the winning alignment read counts highlighted cells without counting CSS', async () => {
  const winning = new Set([0, 7, 14, 21]);
  let reading = false;
  const ui = {
    get: (id: string) => ({
      layout: async () => null,
      text: async () =>
        JSON.stringify({
          current: {
            id: 'game',
            revision: 9,
            status: 'completed',
            white: { kind: 'person', person: 'alice' },
            black: { kind: 'bot', person: '' },
            ready: [],
            turn: 'black',
            outcome: 'white wins',
            moves: [],
          },
          displayFen: 'c4:1:0101010',
        }),
      attribute: async (name: string) => {
        if (reading)
          throw new Error('Invalid state: an evaluate() is already pending');
        reading = true;
        await Promise.resolve();
        reading = false;
        if (name === 'data-winning')
          return String(
            winning.has(Number(id.replace('custom-game-board-cell-', '')))
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
