/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { battleshipGameClient } from '@libs/battleship-client-ts/battleship-game-client';
import { battleshipAutomation } from '@libs/battleship-shared-ts/battleship-automation';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import {
  createSolidDomDriver,
  type SolidDomDriver,
} from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';

let driver: SolidDomDriver | undefined;
afterEach(async () => {
  await driver?.close();
  driver = undefined;
});

/** The registered presentation's board, driven as the game automation drives it. */
function boardDriver(played: string[]): SolidDomDriver {
  const time = createHarnessClock();
  const Board = battleshipGameClient.presentation.Board;
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return createSolidDomDriver({
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
              <Board
                position={encodeBattleshipPosition(['a1:miss', 'b2:miss'])}
                orientation="white"
                interactive
                sound={false}
                syncKey={0}
                hand={null}
                committed={[]}
                commitment={null}
                setup={
                  'fleet:carrier@a3h;battleship@a5h;cruiser@a7h;submarine@a9h;destroyer@h1h'
                }
                testId="board"
                onAction={(action) => played.push(action)}
              />
            </ThemeProvider>
          </ClockProvider>
        </I18nProvider>
      ),
    },
  });
}

test('the game automation fires a shot through the targeting grid', async () => {
  const played: string[] = [];
  driver = boardDriver(played);
  await driver.launch();
  await battleshipAutomation.perform(driver, 'board', 'e5');
  expect(played).toEqual(['e5']);
});

test('the presentation names the game, its sides and its ending', () => {
  const presentation = battleshipGameClient.presentation;
  expect(battleshipGameClient.id).toBe('battleship');
  expect(presentation.name()).toBe('Battleship');
  expect(presentation.canFlip).toBe(false);
  expect(presentation.SetupBoard).toBeDefined();
  expect(presentation.sideLabel('white')).toBe('Blue fleet');
  expect(presentation.sideLabel('black')).toBe('Red fleet');
  expect(presentation.endingDescription('fleet sunk')).toBe(
    'Sank the whole fleet.'
  );
  expect(presentation.endingLabel('fleet sunk')).toBe('fleet sunk');
  expect(presentation.timeoutDrawDescription('black')).toBe(
    'Red fleet ran out of time, but the other side cannot win.'
  );
});
