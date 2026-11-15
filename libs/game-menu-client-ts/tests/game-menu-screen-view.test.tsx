/** @jsxImportSource solid-js */
/** A game's menu is a hub of rows; how to play is a place behind it. */
import { expect, mock, test } from 'bun:test';
import type { GameMenuPlace } from '@libs/game-menu-client-ts/game-menu-places';
import { GameMenuScreenView } from '@libs/game-menu-client-ts/game-menu-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

const RULE =
  'Take turns dropping a disc into a column. Four in a row, column or diagonal wins.';
const RULES = [{ key: 'goal', title: 'Goal', body: RULE }];
const TAGLINE = 'Drop discs and line up four';

function menu(options: {
  width: number;
  instructions: typeof RULES | undefined;
  place: GameMenuPlace;
  onOpen?: (place: GameMenuPlace) => void;
  onChoose?: (screen: string) => void;
}) {
  const harness = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: options.width, height: 900 }}
      >
        <GameMenuScreenView
          title="Connect Four"
          tile="discs"
          subtitle={TAGLINE}
          instructions={options.instructions}
          choices={[
            {
              screen: 'custom-game',
              title: 'Play with friends',
              caption: 'With the people in this space, or bots',
            },
            {
              screen: 'history',
              title: 'History and stats',
              caption: 'Review your games, wins and draws',
            },
          ]}
          onChoose={options.onChoose ?? (() => undefined)}
          place={options.place}
          onOpen={options.onOpen ?? (() => undefined)}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
}

// regression: game-menu-tagline-repeats-rules — under Connect Four's name
// the menu said "Drop discs and line up four" and then the rules, the same
// instruction twice. The rules now have a place of their own: the menu
// says what the game is once and offers how to play as a row.
test.each([390, 1440])(
  'at %ipx the menu holds rows only: the tagline once, and how to play as a row',
  (width) => {
    const view = menu({
      width,
      instructions: RULES,
      place: { screen: 'menu' },
    });
    expect(view.getByText(TAGLINE)).toBeTruthy();
    expect(view.queryByText(RULE)).toBeNull();
    expect(view.getByTestId('game-choice-how-to-play')).toBeTruthy();
    view.unmount();
  }
);

test.each([390, 1440])(
  'at %ipx at most one row of the menu is emphasised',
  (width) => {
    const view = menu({
      width,
      instructions: RULES,
      place: { screen: 'menu' },
    });
    const emphasised = view.container.querySelectorAll(
      '[data-testid^="game-choice-"][data-emphasis="primary"]'
    );
    expect(emphasised.length).toBeLessThanOrEqual(1);
    view.unmount();
  }
);

test('how to play, under the name, opens its place, and that place says the rules', () => {
  const onOpen = mock((_place: GameMenuPlace) => undefined);
  const hub = menu({
    width: 390,
    instructions: RULES,
    place: { screen: 'menu' },
    onOpen,
  });
  hub.getByTestId('game-choice-how-to-play').click();
  expect(onOpen).toHaveBeenCalledWith({ screen: 'how-to-play' });
  hub.unmount();
  const rules = menu({
    width: 390,
    instructions: RULES,
    place: { screen: 'how-to-play' },
  });
  expect(rules.getByText(RULE)).toBeTruthy();
  expect(rules.getByText('Goal')).toBeTruthy();
  expect(rules.queryByTestId('game-choice-custom-game')).toBeNull();
  rules.unmount();
});

test('the rules lead on: play the main way in, or back to the menu', () => {
  const onOpen = mock((_place: GameMenuPlace) => undefined);
  const onChoose = mock((_screen: string) => undefined);
  const rules = menu({
    width: 390,
    instructions: RULES,
    place: { screen: 'how-to-play' },
    onOpen,
    onChoose,
  });
  const play = rules.getByTestId('game-how-to-play-play');
  expect(play.textContent).toContain('Play with friends');
  play.click();
  expect(onChoose).toHaveBeenCalledWith('custom-game');
  // regression: rules-play-forgets-menu-focus — the rules first reopened
  // the menu, which mounted for an instant and forgot the control the
  // keyboard had left it from, so Back from the game focused its heading.
  expect(onOpen).not.toHaveBeenCalled();
  const back = rules.getByTestId('game-how-to-play-back');
  expect(back.textContent).toContain('Connect Four menu');
  back.click();
  expect(onOpen).toHaveBeenCalledWith({ screen: 'menu' });
  rules.unmount();
});

test('the ways to play and the looks back are named apart', () => {
  const view = menu({
    width: 390,
    instructions: RULES,
    place: { screen: 'menu' },
  });
  const play = view.getByText('Play').closest('[data-layout="play"]');
  const more = view.getByText('More').closest('[data-layout="more"]');
  expect(play?.contains(view.getByTestId('game-choice-custom-game'))).toBe(
    true
  );
  expect(more?.contains(view.getByTestId('game-choice-history'))).toBe(true);
  view.unmount();
});

test('a game that says nothing about how to play offers no rules', () => {
  const view = menu({
    width: 390,
    instructions: undefined,
    place: { screen: 'menu' },
  });
  expect(view.queryByTestId('game-choice-how-to-play')).toBeNull();
  expect(view.getByText(TAGLINE)).toBeTruthy();
  view.unmount();
});
