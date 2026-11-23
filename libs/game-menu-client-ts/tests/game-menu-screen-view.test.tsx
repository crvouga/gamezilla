/** @jsxImportSource solid-js */
/** A game's menu is a hub of rows; how to play is a place behind it. */
import { expect, mock, test } from 'bun:test';
import type { GameMenuPlace } from '@libs/game-menu-client-ts/game-menu-places';
import { GameMenuScreenView } from '@libs/game-menu-client-ts/game-menu-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

const RULES =
  'Take turns dropping a disc into a column. Four in a row, column or diagonal wins.';
const TAGLINE = 'Drop discs and line up four';

function menu(options: {
  width: number;
  instructions: string | undefined;
  place: GameMenuPlace;
  onOpen?: (place: GameMenuPlace) => void;
}) {
  return renderWithI18n(() => (
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
        onChoose={() => undefined}
        place={options.place}
        onOpen={options.onOpen ?? (() => undefined)}
      />
    </ThemeProvider>
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
    expect(view.queryByText(RULES)).toBeNull();
    expect(view.getByTestId('game-choice-how-to-play')).toBeTruthy();
    view.unmount();
  }
);

test.each([390, 1440])(
  'at %ipx no row of the menu is recommended or leads',
  (width) => {
    const view = menu({
      width,
      instructions: RULES,
      place: { screen: 'menu' },
    });
    const emphasised = view.container.querySelectorAll(
      '[data-testid^="game-choice-"][data-emphasis="primary"]'
    );
    expect(emphasised).toHaveLength(0);
    expect(view.queryByText('Recommended')).toBeNull();
    view.unmount();
  }
);

test('the how to play row opens its place, and that place says the rules', () => {
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
  expect(rules.getByText(RULES)).toBeTruthy();
  expect(rules.queryByTestId('game-choice-custom-game')).toBeNull();
  rules.unmount();
});

test('a game that says nothing about how to play offers no such row', () => {
  const view = menu({
    width: 390,
    instructions: undefined,
    place: { screen: 'menu' },
  });
  expect(view.queryByTestId('game-choice-how-to-play')).toBeNull();
  expect(view.getByText(TAGLINE)).toBeTruthy();
  view.unmount();
});

const MODES = [
  { id: 'trails', name: 'Duel' },
  { id: 'trails-3', name: 'Trio' },
];

test.each([390, 1440])(
  'at %ipx a game with several modes shows the one set up, and the host switches it',
  (width) => {
    const onChooseMode = mock();
    const view = renderWithI18n(() => (
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
        <GameMenuScreenView
          title="Trails"
          tile="trails"
          subtitle={TAGLINE}
          choices={[]}
          onChoose={() => undefined}
          place={{ screen: 'menu' }}
          onOpen={() => undefined}
          modes={MODES}
          mode="trails"
          onChooseMode={onChooseMode}
        />
      </ThemeProvider>
    ));
    const duel = view.getByTestId('game-modes-trails');
    const trio = view.getByTestId('game-modes-trails-3');
    expect(duel.getAttribute('aria-checked')).toBe('true');
    expect(trio.getAttribute('aria-checked')).toBe('false');
    trio.click();
    expect(onChooseMode).toHaveBeenCalledWith('trails-3');
    view.unmount();
  }
);

test('a guest sees the mode set up but cannot switch it', () => {
  const view = renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 900 }}>
      <GameMenuScreenView
        title="Trails"
        tile="trails"
        subtitle={TAGLINE}
        choices={[]}
        onChoose={() => undefined}
        place={{ screen: 'menu' }}
        onOpen={() => undefined}
        modes={MODES}
        mode="trails-3"
      />
    </ThemeProvider>
  ));
  const trio = view.getByTestId('game-modes-trails-3');
  expect(trio.getAttribute('aria-checked')).toBe('true');
  expect((view.getByTestId('game-modes-trails') as HTMLButtonElement).disabled).toBe(true);
  view.unmount();
});

test('a game with one mode shows no mode choice', () => {
  const view = menu({ width: 390, instructions: RULES, place: { screen: 'menu' } });
  expect(view.queryByTestId('game-modes')).toBeNull();
  view.unmount();
});
