import { expect, test } from 'bun:test';
import { quoridorHillGameShared } from '@libs/quoridor-shared-ts/quoridor-game';

function unused(): never {
  throw new Error('The forced-pass board exposes only its pass control');
}

// regression: quoridor-party-pass-requests-hidden-mode
test('the automated forced pass uses the sole available control', async () => {
  const pressed: string[] = [];
  const perform = quoridorHillGameShared.automation.turns.perform;
  const ui: Parameters<typeof perform>[0] = {
    kind: 'forced-pass',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id) => {
      if (id !== 'board-action-pass') return unused();
      return {
        get: unused,
        attribute: unused,
        tap: unused,
        tapAt: unused,
        drag: unused,
        layout: unused,
        input: unused,
        selectFile: unused,
        clear: unused,
        scroll: unused,
        text: unused,
        isVisible: unused,
        expect: { visible: unused, hidden: unused, text: unused },
        wait: async () => {},
        key: async (key) => {
          pressed.push(key);
        },
      };
    },
  };
  await perform(ui, 'board', 'pass');
  expect(pressed).toEqual(['enter']);
});
