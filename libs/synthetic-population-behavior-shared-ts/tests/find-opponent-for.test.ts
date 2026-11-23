import { expect, test } from 'bun:test';
import { findOpponentFor } from '@libs/synthetic-population-behavior-shared-ts/game-automation';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { automationDriver } from './automation-driver';

const MENU = Handles.gameMenu('counting');
const FIND_AN_OPPONENT = Handles.gameChoice('multiplayer');
const HUB = 'multiplayer-find';
const CLOCK_ROW = 'multiplayer-open-time-control';

function choiceOf(clock: string): string {
  return `multiplayer-time-control-${clock.replace('+', '-')}`;
}

/** A space's game menu whose search hub starts on `hubClock`, offering `offered`. */
function countingSpace(hubClock: string, offered: readonly string[]) {
  const visible = new Set<string>([MENU]);
  const attributes = new Map([[`${CLOCK_ROW}:data-time-control`, hubClock]]);
  const harness = automationDriver({
    visible,
    attributes,
    onTap: (id) => {
      if (id === MENU) visible.add(FIND_AN_OPPONENT);
      if (id === FIND_AN_OPPONENT) {
        visible.add(HUB);
        visible.add(CLOCK_ROW);
      }
      if (id === CLOCK_ROW) {
        visible.delete(HUB);
        visible.add(Handles.navBack);
        for (const clock of offered) visible.add(choiceOf(clock));
      }
      const chosen = offered.find((clock) => id === choiceOf(clock));
      if (chosen !== undefined)
        attributes.set(`${CLOCK_ROW}:data-time-control`, chosen);
      if (chosen !== undefined || id === Handles.navBack) visible.add(HUB);
    },
  });
  return harness;
}

test('a Synthetic User looks at the time control the waiting person chose', async () => {
  const { driver, actions } = countingSpace('5+0', ['5+0', '5+3']);
  expect(
    await findOpponentFor(driver, { gameId: 'counting', timeControl: '5+3' })
  ).toBe(true);
  expect(actions).toContain('multiplayer-time-control-5-3');
  expect(actions.at(-1)).toBe(HUB);
});

test("a hub already on the person's time control is left as it is", async () => {
  const { driver, actions } = countingSpace('5+3', ['5+0', '5+3']);
  expect(
    await findOpponentFor(driver, { gameId: 'counting', timeControl: '5+3' })
  ).toBe(true);
  expect(actions).not.toContain(CLOCK_ROW);
  expect(actions.at(-1)).toBe(HUB);
});

// regression: synthetic-user-joins-another-time-control
test('a Synthetic User never looks at another time control than the person chose', async () => {
  const { driver, actions } = countingSpace('5+0', ['5+0']);
  expect(
    await findOpponentFor(driver, { gameId: 'counting', timeControl: '5+3' })
  ).toBe(false);
  expect(actions).not.toContain(HUB);
});
