/** @jsxImportSource @solidjs/web */
/**
 * A game's menu leads with its first way to play, keeps the other ways to
 * play and the supporting choices in order; how to play is a place
 * behind it.
 */
import { expect, mock, test } from 'bun:test';
import {
  GameHomeScreenView,
  type GameMenuChoiceView,
} from '@libs/game-menu-client-ts/game-home-screen-view';
import type { GameMenuPlace } from '@libs/game-menu-client-ts/game-menu-places';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

const PROMPT = 'Drop your disc in the middle column.';
const step = {
  prompt: () => PROMPT,
  success: () => 'Centre claimed',
  initial: () => '',
  play: () => '4',
  Board: () => null,
};
const LESSON = [step, step] as const;
const TAGLINE = 'Drop discs and line up four';

const PLAY_CHOICES: readonly GameMenuChoiceView[] = [
  {
    screen: 'vs-human',
    title: 'Play a Friend',
    caption: 'Play the people in this space',
  },
  {
    screen: 'history',
    title: 'History and stats',
    caption: 'Review your games, wins and draws',
  },
];

const FIND_AN_OPPONENT: GameMenuChoiceView = {
  screen: 'multiplayer',
  title: 'Matchmaking',
  caption: 'Meet another Connect Four player',
};

function menu(options: {
  width: number;
  lesson: typeof LESSON | undefined;
  place: GameMenuPlace;
  onOpen?: (place: GameMenuPlace) => void;
  onChoose?: (screen: string) => void;
  choices?: readonly GameMenuChoiceView[];
}) {
  return renderWithI18n(() => (
    <ThemeProvider fixedLayout={{ width: options.width, height: 900 }}>
      <GameHomeScreenView
        title="Connect Four"
        tile="discs"
        subtitle={TAGLINE}
        lesson={options.lesson}
        choices={options.choices ?? PLAY_CHOICES}
        onChoose={options.onChoose ?? (() => undefined)}
        place={options.place}
        onOpen={options.onOpen ?? (() => undefined)}
      />
    </ThemeProvider>
  ));
}

// regression: game-menu-tagline-repeats-rules — under Connect Four's name
// the menu said "Drop discs and line up four" and then the rules, the same
// instruction twice. The rules now have a place of their own: the menu
// says what the game is once and offers how to play as a direct row.
test.each([390, 1440])(
  'at %ipx the menu omits its subtitle, and how to play is a direct row',
  (width) => {
    const view = menu({
      width,
      lesson: LESSON,
      place: { screen: 'home' },
    });
    expect(view.queryByText(TAGLINE)).toBeNull();
    expect(view.queryByText(PROMPT)).toBeNull();

    expect(view.getByTestId('game-choice-how-to-play')).toBeTruthy();
    view.unmount();
  }
);

test.each([390, 1440])(
  'at %ipx the first way to play is the one primary control and no row is tagged',
  (width) => {
    const view = menu({
      width,
      lesson: LESSON,
      place: { screen: 'home' },
      choices: [FIND_AN_OPPONENT, ...PLAY_CHOICES],
    });
    const primary = view.container.querySelectorAll(
      '[data-testid^="game-choice-"][data-emphasis="primary"]'
    );
    expect(primary).toHaveLength(1);
    expect(primary[0]?.getAttribute('data-testid')).toBe(
      'game-choice-multiplayer'
    );
    expect(primary[0]?.textContent).toContain('Matchmaking');
    expect(
      view.getByTestId('game-choice-vs-human').getAttribute('data-emphasis')
    ).toBeNull();
    expect(view.queryByText('Recommended')).toBeNull();
    view.unmount();
  }
);

test('the primary control is finding an opponent, else vs human, else puzzles', () => {
  const puzzle: GameMenuChoiceView = {
    screen: 'puzzle',
    title: 'Puzzle',
    caption: 'Solve rated puzzles and climb the ladder',
  };
  const stats: GameMenuChoiceView = {
    screen: 'stats',
    title: 'History and stats',
    caption: 'Puzzle rating trend and game log',
  };
  const leads = (choices: readonly GameMenuChoiceView[]): string | null => {
    const view = menu({
      width: 390,
      lesson: undefined,
      place: { screen: 'home' },
      choices,
    });
    const lead = view.container
      .querySelector('[data-emphasis="primary"][data-testid^="game-choice-"]')
      ?.getAttribute('data-testid');
    view.unmount();
    return lead ?? null;
  };
  expect(leads([FIND_AN_OPPONENT, PLAY_CHOICES[0]!, puzzle, stats])).toBe(
    'game-choice-multiplayer'
  );
  expect(leads([PLAY_CHOICES[0]!, puzzle, stats])).toBe('game-choice-vs-human');
  expect(leads([puzzle, stats])).toBe('game-choice-puzzle');
});

test('the other ways to play are full-width rows with their captions', () => {
  const view = menu({
    width: 390,
    lesson: LESSON,
    place: { screen: 'home' },
    choices: [FIND_AN_OPPONENT, ...PLAY_CHOICES],
  });
  const custom = view.getByTestId('game-choice-vs-human');
  expect(custom.closest('ul')).not.toBeNull();
  expect(custom.getAttribute('data-emphasis')).toBeNull();
  expect(custom.textContent).toContain('Play a Friend');
  view.unmount();
});

test('every offered choice is directly available in catalog order, followed by the lesson', () => {
  const view = menu({
    width: 390,
    lesson: LESSON,
    place: { screen: 'home' },
    choices: [FIND_AN_OPPONENT, ...PLAY_CHOICES],
  });
  expect(view.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
    ['Matchmaking', 'Play a Friend', 'History and stats', 'How to play']
  );
  view.unmount();
});

test('a supporting choice opens through the same onChoose', () => {
  const onChoose = mock((_screen: string) => undefined);
  const view = menu({
    width: 390,
    lesson: LESSON,
    place: { screen: 'home' },
    onChoose,
  });

  view.getByTestId('game-choice-history').click();
  expect(onChoose).toHaveBeenCalledWith('history');
  view.getByTestId('game-choice-vs-human').click();
  expect(onChoose).toHaveBeenCalledWith('vs-human');
  view.unmount();
});

test('the how to play row opens its place, and that place gives the first move', () => {
  const onOpen = mock((_place: GameMenuPlace) => undefined);
  const hub = menu({
    width: 390,
    lesson: LESSON,
    place: { screen: 'home' },
    onOpen,
  });

  hub.getByTestId('game-choice-how-to-play').click();
  expect(onOpen).toHaveBeenCalledWith({ screen: 'how-to-play' });
  hub.unmount();
  const rules = menu({
    width: 390,
    lesson: LESSON,
    place: { screen: 'how-to-play' },
  });
  expect(rules.getByText(PROMPT)).toBeTruthy();
  expect(rules.queryByTestId('game-choice-vs-human')).toBeNull();
  rules.unmount();
});

test('a game that says nothing about how to play offers no such row', () => {
  const view = menu({
    width: 390,
    lesson: undefined,
    place: { screen: 'home' },
  });

  expect(view.queryByTestId('game-choice-how-to-play')).toBeNull();
  expect(view.queryByText(TAGLINE)).toBeNull();
  view.unmount();
});

test('the game menu offers its destinations without a mode choice', () => {
  const view = menu({
    width: 390,
    lesson: LESSON,
    place: { screen: 'home' },
  });
  expect(view.queryByTestId('game-modes')).toBeNull();
  view.unmount();
});
