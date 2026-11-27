/** @jsxImportSource @solidjs/web */
import { afterEach, expect, test } from 'bun:test';
import { BattleshipSetupBoard } from '@libs/battleship-client-ts/battleship-setup-board';
import { battleshipAutomation } from '@libs/battleship-shared-ts/battleship-automation';
import { placeShipOnSetupBoard } from '@libs/battleship-shared-ts/battleship-setup-gestures';
import { setupI18n } from '@lingui/core';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import {
  createSolidDomDriver,
  type SolidDomDriver,
} from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { createSignal } from 'solid-js';

const BLUE =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
const RED =
  'fleet:carrier@f2h;battleship@f4h;cruiser@f6h;submarine@f8h;destroyer@f10h';
/** A fleet whose ships lie where Red's carrier goes before it moves. */
const CROSSING =
  'fleet:carrier@b1h;battleship@g2v;cruiser@a5h;submarine@a7h;destroyer@a9h';

let driver: SolidDomDriver | undefined;
afterEach(async () => {
  await driver?.close();
  driver = undefined;
});

/** The setup board holding `initial`, driven as the game automation drives it. */
function setupBoardDriver(initial: string) {
  const time = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const [setup, setSetup] = createSignal(initial);
  const changes: string[] = [];
  const board = createSolidDomDriver({
    clock: time.clock,
    pump: async () => {
      time.clock.advance(1);
      await Promise.resolve();
    },
    harness: {
      createRoot: () => () => (
        <I18nProvider i18n={i18n}>
          <ClockProvider clock={time.clock} timers={time.timers}>
            <ThemeProvider colorScheme="light">
              <SurfaceStackProvider>
                <BattleshipSetupBoard
                  setup={setup()}
                  side="white"
                  locked={false}
                  testId="setup"
                  onChange={(next) => {
                    changes.push(next);
                    setSetup(next);
                  }}
                />
              </SurfaceStackProvider>
            </ThemeProvider>
          </ClockProvider>
        </I18nProvider>
      ),
    },
  });
  return { board, setup, changes };
}

test.each([
  ['an empty board', ''],
  ['another whole fleet', BLUE],
  ['a fleet in the way of the new one', CROSSING],
])(
  'the game automation arranges a whole fleet over %s',
  async (_name, initial) => {
    // regression: battleship-arrange-over-fleet
    const { board, setup } = setupBoardDriver(initial);
    driver = board;
    await driver.launch();
    await battleshipAutomation.arrange?.(driver, 'setup', RED);
    expect(setup()).toBe(RED);
  }
);

test('phone multiplayer setup arranges the literal fleet through the default precision controls', async () => {
  // regression: battleship-phone-setup-automation
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  try {
    const { board, setup } = setupBoardDriver(BLUE);
    driver = board;
    await driver.launch();
    await driver.get('setup-precision-cell-a1').expect.visible();
    await battleshipAutomation.arrange?.(driver, 'setup', RED);
    expect(setup()).toBe(RED);
    await driver.get('setup-precision-cell-j10').expect.visible();
  } finally {
    await driver?.close();
    driver = undefined;
    if (original) Object.defineProperty(window, 'matchMedia', original);
    else Reflect.deleteProperty(window, 'matchMedia');
  }
});

// regression: harness-package-tests-default-five-second-timeout
// regression: battleship-inert-overview-skips-harness-input
// regression: battleship-carrier-setup-lineup-timeout
test('the setup adapter attempts Carrier at G1 through the visible precision controls', async () => {
  const mounted = setupBoardDriver('');
  driver = mounted.board;
  await driver.launch();
  await driver.get('setup-enlarge').key('enter');
  await placeShipOnSetupBoard(
    driver,
    'setup',
    { ship: 'carrier', cell: 'g1', orientation: 'h' },
    true
  );
  await driver.get('setup-precision-cell-g1').expect.visible();
  expect(await driver.get('setup-refusal').text()).toContain(
    'run off the board'
  );
  expect(mounted.setup()).toBe('');
});

test('a refused bow leaves a previously placed ship where it was before turning', async () => {
  const fleet = 'fleet:carrier@a1h';
  const mounted = setupBoardDriver(fleet);
  driver = mounted.board;
  await driver.launch();
  await placeShipOnSetupBoard(
    driver,
    'setup',
    { ship: 'carrier', cell: 'a8', orientation: 'v' },
    true
  );
  expect(mounted.changes).toEqual(['fleet:carrier@a1v', fleet]);
  expect(mounted.setup()).toBe(fleet);
});
