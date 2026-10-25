/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { heartsGameClient } from '@libs/hearts-client-ts/hearts-game-client';
import { heartsGameShared } from '@libs/hearts-shared-ts/hearts-game';
import { encodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import {
  createSolidDomDriver,
  type SolidDomDriver,
} from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { fireEvent } from '@solidjs/testing-library';
import { byTestId, renderBoard } from './render';

const CLUBS = '2C3C4C5C6C7C8C9CTCJCQCKCAC';
/** South holds every club; the first trick of a deal without passing. */
const HOLD_START = encodeHearts({
  deal: 4,
  phase: 'play',
  scores: [10, 20, 30, 40],
  lead: 0,
  plays: [],
  last: [0, 0, 0, 0],
});

function board(overrides: Partial<GameBoardProps>, played: string[] = []) {
  return renderBoard(() => (
    <HeartsBoard
      position={heartsRules.initial()}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={null}
      hand={CLUBS}
      committed={[]}
      commitment={null}
      testId="hearts"
      onAction={(action) => played.push(action)}
      {...overrides}
    />
  ));
}

const disabled = (card: string) =>
  byTestId(`hearts-card-${card}`).getAttribute('aria-disabled') === 'true';

test('the viewer sits nearest, named as their own seat, with every seat around the table', () => {
  board({ orientation: 'red' });
  expect(byTestId('hearts-seat-red').getAttribute('data-position')).toBe('bottom');
  expect(byTestId('hearts-seat-red').getAttribute('aria-label')).toBe('North (you)');
  expect(byTestId('hearts-seat-blue').getAttribute('data-position')).toBe('left');
  expect(byTestId('hearts-seat-white').getAttribute('data-position')).toBe('top');
  expect(byTestId('hearts-seat-black').getAttribute('data-position')).toBe('right');
});

test('a watcher sees the table, every seat\'s hand size and score, and no hand', () => {
  board({ hand: null, position: HOLD_START, interactive: false });
  expect(byTestId('hearts-hand').children).toHaveLength(0);
  expect(byTestId('hearts-seat-white').getAttribute('aria-label')).toBe('South');
  expect(byTestId('hearts-seat-blue').textContent).toContain('13 cards');
  expect(byTestId('hearts-seat-blue').textContent).toContain('Score 40');
});

test('only the cards the rules allow can be played; the two of clubs leads', () => {
  const played: string[] = [];
  board({ position: HOLD_START }, played);
  expect(disabled('2C')).toBe(false);
  expect(disabled('3C')).toBe(true);
  fireEvent.click(byTestId('hearts-card-3C'));
  expect(played).toEqual([]);
  fireEvent.click(byTestId('hearts-card-2C'));
  expect(played).toEqual(['2C']);
});

test('three cards are chosen, then passed together; passing progress shows who has passed, never what', () => {
  const played: string[] = [];
  board({ committed: ['black'] }, played);
  expect(byTestId('hearts-seat-black').textContent).toContain('Passed');
  expect(byTestId('hearts-seat-red').textContent).toContain('Choosing');
  const pass = () => byTestId('hearts-pass') as HTMLButtonElement;
  expect(pass().disabled).toBe(true);
  for (const card of ['AC', 'KC', 'QC']) fireEvent.click(byTestId(`hearts-card-${card}`));
  fireEvent.click(byTestId('hearts-card-JC'));
  expect(byTestId('hearts-card-JC').getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(pass());
  expect(played).toEqual(['QCKCAC']);
});

test('once passed, the cards stay chosen and nothing more can be passed', () => {
  board({ commitment: 'QCKCAC', committed: ['white'] });
  expect(byTestId('hearts-card-QC').getAttribute('aria-pressed')).toBe('true');
  expect(disabled('2C')).toBe(true);
  expect(document.querySelector('[data-testid="hearts-pass"]')).toBeNull();
  expect(byTestId('hearts-center').textContent).toContain('Waiting for every player to pass');
});

let driver: SolidDomDriver | undefined;
afterEach(async () => {
  await driver?.close();
  driver = undefined;
});

test('the game automation passes and plays through the board as a person does', async () => {
  const played: string[] = [];
  const time = createHarnessClock();
  const Board = heartsGameClient.presentation.Board;
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const [position, setPosition] = [{ value: heartsRules.initial() }, (p: string) => { position.value = p; }];
  driver = createSolidDomDriver({
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
                position={position.value}
                orientation="white"
                interactive
                sound={false}
                syncKey={0}
                hand={CLUBS}
                committed={[]}
                commitment={null}
                setup={null}
                testId="board"
                onAction={(action) => played.push(action)}
              />
            </ThemeProvider>
          </ClockProvider>
        </I18nProvider>
      ),
    },
  });
  setPosition(heartsRules.initial());
  await driver.launch();
  await heartsGameShared.automation.perform(driver, 'board', '2C3C4C');
  expect(played).toEqual(['2C3C4C']);
});

test('the presentation names the game, its seats and its ending', () => {
  const presentation = heartsGameClient.presentation;
  expect(heartsGameClient.id).toBe('hearts');
  expect(presentation.name()).toBe('Hearts');
  expect(presentation.canFlip).toBe(false);
  expect(presentation.SetupBoard).toBeUndefined();
  expect(['white', 'black', 'red', 'blue'].map((s) => presentation.sideLabel(s as 'white'))).toEqual([
    'South',
    'West',
    'North',
    'East',
  ]);
  expect(presentation.endingLabel('lowest score')).toBe('the lowest score');
  expect(presentation.endingDescription('lowest score')).toBe(
    'A score reached 100, and the lowest score wins.'
  );
});
