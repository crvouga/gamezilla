import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The sidebar's conventions (README, "Sidebar organization"): the top level
 * is the level of abstraction, a product area is a folder inside a level,
 * and a folder's stories share its prefix.
 */

const ROOT = resolve(import.meta.dirname, '../../..');
const LEVELS = [
  'Foundations',
  'Atoms',
  'Molecules',
  'Organisms',
  'Templates',
  'Screens',
];
/** A component's exported name, then an optional lowercase qualifier. */
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*( [a-z][a-z ]*)?$/;

type StoryFile = { path: string; title: string; id: string | undefined };

function storyFiles(): StoryFile[] {
  const files: StoryFile[] = [];
  for (const pattern of [
    'pkgs/*/src/**/*.stories.tsx',
    'libs/*/src/**/*.stories.tsx',
  ])
    for (const path of new Bun.Glob(pattern).scanSync({ cwd: ROOT })) {
      const source = readFileSync(resolve(ROOT, path), 'utf8');
      // The meta object: fixtures above it may carry a `title` of their own.
      const meta = source.slice(Math.max(0, source.indexOf('const meta')));
      const title = /^ {2}title: '([^']+)'/m.exec(meta)?.[1];
      if (title === undefined) throw new Error(`${path}: no meta title`);
      files.push({
        path: path.replaceAll('\\', '/'),
        title,
        id: /^ {2}id: '([^']+)'/m.exec(meta)?.[1],
      });
    }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const stories = storyFiles();
const where = (found: readonly StoryFile[]): string[] =>
  found.map((story) => `${story.title} (${story.path})`);

test('the top level of every title is a level of abstraction', () => {
  expect(
    where(
      stories.filter(
        (story) => !LEVELS.includes(story.title.split('/')[0] ?? '')
      )
    )
  ).toEqual([]);
});

test('every story file sets an explicit id, and ids and titles are unique', () => {
  expect(where(stories.filter((story) => story.id === undefined))).toEqual([]);
  for (const key of ['title', 'id'] as const) {
    const seen = new Map<string, number>();
    for (const story of stories)
      seen.set(story[key] ?? '', (seen.get(story[key] ?? '') ?? 0) + 1);
    expect(
      where(stories.filter((story) => (seen.get(story[key] ?? '') ?? 0) > 1))
    ).toEqual([]);
  }
});

test('screens live in libs as Screens/<Area>/<Screen>; the design system lives in pkgs', () => {
  expect(
    where(
      stories.filter(
        (story) =>
          story.path.startsWith('libs/') !== story.title.startsWith('Screens/')
      )
    )
  ).toEqual([]);
  expect(
    where(
      stories.filter(
        (story) =>
          story.title.startsWith('Screens/') &&
          story.title.split('/').length < 3
      )
    )
  ).toEqual([]);
});

/** Named for what it shows, not for a component: recipes and one game's surfaces. */
function namedForItsSubject(title: string): boolean {
  if (title.startsWith('Organisms/Patterns/')) return true;
  return (
    title.startsWith('Organisms/Games/') &&
    !title.startsWith('Organisms/Games/Shared/')
  );
}

test('a design-system story is titled with its component name', () => {
  expect(
    where(
      stories.filter(
        (story) =>
          !story.title.startsWith('Screens/') &&
          !namedForItsSubject(story.title) &&
          !COMPONENT_NAME.test(story.title.split('/').at(-1) ?? '')
      )
    )
  ).toEqual([]);
});

test("an area's stories share its prefix in every level", () => {
  const prefixes: readonly (readonly [string, string])[] = [
    ['Organisms/Space/', 'Space'],
    ['Templates/Space/', 'Space'],
    ['Organisms/Games/Shared/', 'Game'],
    ['Templates/Games/', 'Game'],
  ];
  for (const [folder, prefix] of prefixes) {
    const inside = stories.filter((story) => story.title.startsWith(folder));
    expect(inside.length).toBeGreaterThan(0);
    expect(
      where(
        inside.filter(
          (story) =>
            !(story.title.slice(folder.length).split('/')[0] ?? '').startsWith(
              prefix
            )
        )
      )
    ).toEqual([]);
  }
  // An area is never a level of its own, and never sits loose in a level.
  expect(
    where(
      stories.filter((story) =>
        /^(Atoms|Molecules|Organisms|Templates)\/(Space|Game)[A-Z]/.test(
          story.title
        )
      )
    )
  ).toEqual([]);
});

test('the sidebar lists the most composed level first and folds the building blocks', () => {
  const read = (file: string) =>
    readFileSync(
      resolve(ROOT, 'pkgs/ui-root-harness-ts/storybook', file),
      'utf8'
    );
  const order = [...LEVELS].reverse();
  const sorted =
    /order: \[([\s\S]*?)\n {8}\],/.exec(read('preview.tsx'))?.[1] ?? '';
  expect([...sorted.matchAll(/'([^']+)'/g)].map((match) => match[1])).toEqual([
    'Start here',
    'Screens',
    // Nested under Screens: the Space area leads it.
    'Space',
    ...order.slice(1),
  ]);
  expect(read('preview.tsx')).toContain("method: 'alphabetical'");
  expect(read('manager.ts')).toContain(
    "collapsedRoots: ['organisms', 'molecules', 'atoms']"
  );
});
