/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { WordTilesBoard } from '@libs/word-tiles-client-ts/word-tiles-board';
import { wordTilesAutomation } from '@libs/word-tiles-shared-ts/word-tiles-automation';
import {
  encodePosition,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import {
  createSolidDomDriver,
  type SolidDomDriver,
} from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';

let driver: SolidDomDriver | undefined;
afterEach(async () => {
  await driver?.close();
  driver = undefined;
});

/** The registered presentation's board, driven as the game automation drives it. */
function boardDriver(
  played: string[],
  hand = '11,0,82,98,25,77,69'
): SolidDomDriver {
  const time = createHarnessClock();

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
              <SurfaceStackProvider>
                <IdProvider createId={() => 'id'} random={() => 0.5}>
                  <WordTilesBoard
                    position={encodePosition(
                      newPosition(2, 'enable1.90ef7a729517')
                    )}
                    orientation="white"
                    interactive
                    sound={false}
                    syncKey={0}
                    hand={hand}
                    committed={[]}
                    commitment={null}
                    setup={null}
                    testId="board"
                    onAction={(action) => played.push(action)}
                  />
                </IdProvider>
              </SurfaceStackProvider>
            </ThemeProvider>
          </ClockProvider>
        </I18nProvider>
      ),
    },
  });
}

// regression: word-tiles-automation-collapsed-tools
// Partition 115, seed 1 selected the literal pass proposal.
test.each(['pass', 'swap:11.0'])(
  'automation performs %s from collapsed tools',
  async (proposal) => {
    const played: string[] = [];
    driver = boardDriver(
      played,
      proposal === 'pass' ? '53,83,77,18,76,64,92' : undefined
    );
    await driver.launch();
    expect(await driver.get('board-more').attribute('aria-expanded')).toBe(
      'false'
    );
    await wordTilesAutomation.perform(driver, 'board', proposal);
    expect(played).toEqual([proposal]);
    if (proposal === 'pass') {
      expect(await driver.get('board-more').attribute('aria-expanded')).toBe(
        'false'
      );
      await wordTilesAutomation.perform(driver, 'board', 'pass');
      expect(played).toEqual(['pass', 'pass']);
    } else {
      await driver.get('board-exchange-confirm').expect.visible();
    }
  }
);

// regression: word-tiles-automation-collapsed-tools
test.each(['pass', 'swap:11.0'])(
  'automation preserves already expanded tools for %s',
  async (proposal) => {
    const played: string[] = [];
    driver = boardDriver(
      played,
      proposal === 'pass' ? '53,83,77,18,76,64,92' : undefined
    );
    await driver.launch();
    await driver.get('board-more').tap();
    expect(await driver.get('board-more').attribute('aria-expanded')).toBe(
      'true'
    );
    await wordTilesAutomation.perform(driver, 'board', proposal);
    expect(played).toEqual([proposal]);
  }
);

test.each(['play:g8=11.h8=0.i8=82', 'play:g8=11.h8=98A.i8=82'])(
  'automation preserves placement and blank assignment: %s',
  async (proposal) => {
    const played: string[] = [];
    driver = boardDriver(played);
    await driver.launch();
    await wordTilesAutomation.perform(driver, 'board', proposal);
    expect(played).toEqual([proposal]);
  }
);
