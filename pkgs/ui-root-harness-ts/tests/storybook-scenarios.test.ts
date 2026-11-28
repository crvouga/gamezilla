import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { storyNameFromExport, toId } from 'storybook/internal/csf';
import {
  type StoryGlobalsMatrix,
  storyGlobalsCombinations,
  storyGlobalsMatrices,
  supportsStoryViewport,
  visualScenarios,
} from '../storybook/scenarios';

const SIDEBAR = {
  id: 'screens-shell-header-island--sidebar-spaces-current',
  importPath:
    '../../libs/app-root-client-ts/src/app-header-island-view.stories.tsx',
  tags: ['viewport-desktop'],
};

// regression: storybook-sidebar-compact-viewport
test('storybook sidebar viewport matrix captures both themes where the rail exists', () => {
  expect(
    visualScenarios(SIDEBAR).map(({ width, theme }) => ({ width, theme }))
  ).toEqual([
    { width: 1440, theme: 'light' },
    { width: 1440, theme: 'dark' },
  ]);
});

test('storybook untagged chrome retains its existing responsive coverage', () => {
  for (const id of ['screens-shell-tab-bar--spaces-current']) {
    expect([
      ...new Set(
        visualScenarios({ ...SIDEBAR, id, tags: [] }).map((s) => s.width)
      ),
    ]).toEqual([390, 1440]);
  }
  expect([
    ...new Set(
      visualScenarios({
        ...SIDEBAR,
        id: 'layouts-appframe--states',
        tags: [],
      }).map((s) => s.width)
    ),
  ]).toEqual([390, 1440, 768]);
});

// regression: storybook-header-compact-viewport
test('storybook literal Search and Notifications headers retain both desktop themes without unsupported phone captures', () => {
  for (const name of ['search-current', 'notifications-current']) {
    expect(
      visualScenarios({
        ...SIDEBAR,
        id: `screens-shell-header-island--${name}`,
      }).map(({ width, height, theme }) => ({ width, height, theme }))
    ).toEqual([
      { width: 1440, height: 844, theme: 'light' },
      { width: 1440, height: 844, theme: 'dark' },
    ]);
  }
});

// regression: storybook-sidebar-compact-viewport
test('storybook viewport eligibility follows the production desktop boundary', () => {
  expect(
    [390, 768, 1023, 1024, 1440].map((width) =>
      supportsStoryViewport(SIDEBAR, width)
    )
  ).toEqual([false, false, false, true, true]);
  expect(
    [390, 768, 1440].map((width) => supportsStoryViewport({ tags: [] }, width))
  ).toEqual([true, true, true]);
  expect(supportsStoryViewport({}, 390)).toBe(true);
});

// regression: storybook-explicit-responsive-baselines-unowned
test('storybook responsive tags own phone and desktop evidence for game components', () => {
  const stories = [
    {
      id: 'games-battleship-placement-layout--enlarged',
      slice: 'battleship-placement-layout',
    },
    {
      id: 'games-battleship-target-layout--precise',
      slice: 'battleship-target-layout',
    },
    { id: 'product-wordtileworkbench--recovery', slice: 'word-tile-workbench' },
    {
      id: 'product-wordtileworkbench--secondary-tools',
      slice: 'word-tile-workbench',
    },
  ];
  for (const { id, slice } of stories) {
    const story = {
      id,
      importPath: `../ui-root-client-ts/src/${slice}/${slice}.stories.tsx`,
      tags: ['viewport-responsive'],
    };
    const scenarios = visualScenarios(story);
    expect(scenarios.map(({ width, theme }) => ({ width, theme }))).toEqual([
      { width: 390, theme: 'light' },
      { width: 390, theme: 'dark' },
      { width: 1440, theme: 'light' },
      { width: 1440, theme: 'dark' },
    ]);
    expect(
      scenarios
        .filter(({ width }) => width === 1440)
        .map(({ suffix }) => suffix)
    ).toEqual(['-1440', '-1440']);
    expect(
      visualScenarios({ ...story, tags: [] }).map(({ width }) => width)
    ).toEqual([390, 390]);
  }
});

test('storybook responsive tags compose with desktop-only eligibility without duplicate scenarios', () => {
  expect(
    visualScenarios({
      ...SIDEBAR,
      tags: ['viewport-responsive', 'viewport-desktop'],
    }).map(({ width }) => width)
  ).toEqual([1440, 1440]);
  expect(
    visualScenarios({ ...SIDEBAR, tags: ['viewport-responsive'] }).map(
      ({ width }) => width
    )
  ).toEqual([390, 390, 1440, 1440]);
});

// regression: storybook-desktop-captured-at-phone-height — a desktop (1440)
// capture used the phone's 844px height although the desktop viewport is
// 1440x900, so states a desktop window shows fell below the reference.
test('a story asking for native heights captures each width at its own viewport height', () => {
  const frame = {
    ...SIDEBAR,
    id: 'screens-game-sessions-stage--your-turn',
    tags: ['viewport-native-height'],
  };
  expect(
    visualScenarios(frame).map(({ width, height }) => ({ width, height }))
  ).toEqual([
    { width: 390, height: 844 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
    { width: 1440, height: 900 },
  ]);
  expect(
    new Set(visualScenarios({ ...frame, tags: [] }).map(({ height }) => height))
  ).toEqual(new Set([844]));
});

test('stories without a globals matrix keep their scenario names and open with the theme alone', () => {
  const scenarios = visualScenarios({
    ...SIDEBAR,
    id: 'screens-shell-tab-bar--spaces-current',
    tags: [],
  });
  expect(
    scenarios.map(({ suffix, globals, theme }) => ({ suffix, globals, theme }))
  ).toEqual([
    { suffix: '', globals: {}, theme: 'light' },
    { suffix: '', globals: {}, theme: 'dark' },
    { suffix: '-1440', globals: {}, theme: 'light' },
    { suffix: '-1440', globals: {}, theme: 'dark' },
  ]);
});

test('globals combinations cross every value in declaration order', () => {
  expect(storyGlobalsCombinations(undefined)).toEqual([{}]);
  expect(
    storyGlobalsCombinations({ game: ['a', 'b'], role: ['x', 'y'] })
  ).toEqual([
    { game: 'a', role: 'x' },
    { game: 'a', role: 'y' },
    { game: 'b', role: 'x' },
    { game: 'b', role: 'y' },
  ]);
});

test('a globals-matrix story owns one scenario per combination, theme and width', () => {
  const story = {
    id: 'space-in-game--screen',
    importPath:
      '../chess-board-root-client-ts/src/chess-board/space-in-game-template.stories.tsx',
    tags: ['viewport-responsive'],
  };
  const scenarios = visualScenarios(story);
  // 2 widths x 5 games x 2 roles x 2 themes. Chess is one of the games,
  // though its board comes from its own package.
  expect(scenarios).toHaveLength(40);
  expect(
    new Set(scenarios.map(({ theme, suffix }) => `${theme}${suffix}`)).size
  ).toBe(40);
  expect(
    scenarios
      .filter(({ globals }) => globals['spaceGame'] === 'chess')
      .map(({ suffix }) => suffix)
  ).toEqual([
    '-chess-host',
    '-chess-host',
    '-chess-guest',
    '-chess-guest',
    '-1440-chess-host',
    '-1440-chess-host',
    '-1440-chess-guest',
    '-1440-chess-guest',
  ]);
  const hearts = scenarios.filter(
    ({ globals }) =>
      globals['spaceGame'] === 'hearts' && globals['spaceRole'] === 'host'
  );
  expect(
    hearts.map(({ width, theme, suffix, globals }) => ({
      width,
      theme,
      suffix,
      globals,
    }))
  ).toEqual(
    [
      [390, 'light', ''],
      [390, 'dark', ''],
      [1440, 'light', '-1440'],
      [1440, 'dark', '-1440'],
    ].map(([width, theme, size]) => ({
      width: width as number,
      theme: theme as string,
      suffix: `${size}-hearts-host`,
      globals: { spaceGame: 'hearts', spaceRole: 'host' },
    }))
  );
  expect(
    visualScenarios({ ...story, id: 'space-choosing--screen' }).map(
      ({ suffix }) => suffix
    )
  ).toEqual([
    '-light-cycles-host',
    '-light-cycles-host',
    '-light-cycles-guest',
    '-light-cycles-guest',
    '-1440-light-cycles-host',
    '-1440-light-cycles-host',
    '-1440-light-cycles-guest',
    '-1440-light-cycles-guest',
  ]);
});

type MatrixStory = { parameters?: { spaceMatrix?: SpaceMatrix } };
type SpaceMatrix = { games: readonly string[]; roles: readonly string[] };

// The index carries no story parameters, so the browser suite's registry must
// equal what each story declares in `parameters.spaceMatrix`.
test('the globals-matrix registry matches every story that declares a space matrix', async () => {
  const root = resolve(import.meta.dirname, '../../..');
  const declared: Record<string, StoryGlobalsMatrix> = {};
  for (const pattern of [
    'pkgs/*/src/**/*.stories.tsx',
    'libs/*/src/**/*.stories.tsx',
  ])
    for (const path of new Bun.Glob(pattern).scanSync({ cwd: root })) {
      const file = resolve(root, path);
      if (!readFileSync(file, 'utf8').includes('spaceMatrix')) continue;
      const module = (await import(file)) as Record<
        string,
        MatrixStory | undefined
      > & {
        default: MatrixStory & { id?: string; title?: string };
      };
      const { default: meta, ...stories } = module;
      for (const [name, story] of Object.entries(stories)) {
        const matrix =
          story?.parameters?.spaceMatrix ?? meta.parameters?.spaceMatrix;
        if (!matrix) continue;
        const id = toId(
          meta.id ?? meta.title ?? path,
          storyNameFromExport(name)
        );
        declared[id] = { spaceGame: matrix.games, spaceRole: matrix.roles };
      }
    }
  expect(declared).toEqual(storyGlobalsMatrices);
});
