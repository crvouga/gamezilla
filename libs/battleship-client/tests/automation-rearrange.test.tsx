/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { BattleshipSetupBoard } from '@libs/battleship-client/battleship-setup-board';
import { battleshipAutomation } from '@libs/battleship-shared/battleship-automation';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import {
  createSolidDomDriver,
  type SolidDomDriver,
} from '@pkgs/ui-testing-solid-dom-client/solid-dom-driver';
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
              <BattleshipSetupBoard
                setup={setup()}
                side="white"
                locked={false}
                testId="setup"
                onChange={setSetup}
              />
            </ThemeProvider>
          </ClockProvider>
        </I18nProvider>
      ),
    },
  });
  return { board, setup };
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
