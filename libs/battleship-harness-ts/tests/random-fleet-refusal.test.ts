import { expect, test } from 'bun:test';
import { askForRandomFleet } from '@libs/battleship-harness-ts/battleship-actions';

const RANDOM = 'custom-game-setup-random';

// regression: battleship-random-fleet-disabled-tap
test('asking for a random fleet while ready leaves the disabled control unpressed', async () => {
  // Alice is ready: "Random fleet" is shown but disabled, and a real browser
  // never delivers a press to a disabled control.
  const node = (testId: string) => ({
    isVisible: async () => testId === RANDOM,
    attribute: async (name: string) =>
      testId === RANDOM && name === 'disabled' ? '' : null,
    tap: async () => {
      throw new Error(`${testId} tap: native click never delivered a press`);
    },
  });
  const s = {
    actors: new Map([['alice', { ui: { get: node } }]]),
    session: { waitForIdle: async () => {} },
  } as never;
  await expect(askForRandomFleet.act(s, 'alice')).resolves.toBeUndefined();
});
