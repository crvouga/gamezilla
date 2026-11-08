import { expect, test } from 'bun:test';
import { supportsStoryViewport, visualScenarios } from '../storybook/scenarios';

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
