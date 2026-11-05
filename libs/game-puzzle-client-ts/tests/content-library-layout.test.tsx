/** @jsxImportSource solid-js */
/** The puzzle library: Browse, Continue and My creations, each said once. */

import { afterEach, expect, test } from 'bun:test';
import {
  ContentLibraryScreenView,
  type ContentLibraryScreenViewProps,
} from '@libs/game-puzzle-client-ts/content-library-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const none = (): void => undefined;

const PUBLISHED_PUZZLE = {
  id: 'revision-1',
  document_id: 'document-1',
  kind: 'puzzle',
  title: 'Count to seven',
  description: '',
  difficulty: 'Easy',
} as const;

const VIEW: ContentLibraryScreenViewProps = {
  status: 'ready',
  title: 'Counting',
  bundledPacks: [],
  drafts: [
    {
      id: 'draft-1',
      kind: 'puzzle',
      title: 'Count to eleven',
      status: 'draft',
    },
  ],
  attempts: [
    { id: 'attempt-1', title: 'Count to seven', completed: false },
    { id: 'attempt-2', title: 'Count to nine', completed: true },
  ],
  playtests: [{ id: 'playtest-1', title: 'Count to eleven', completed: false }],
  published: [
    {
      id: 'revision-1',
      document_id: 'document-1',
      kind: 'puzzle',
      title: 'Count to seven',
      description: '',
      difficulty: 'Easy',
    },
  ],
  more: { owned: false, attempts: false, published: false },
  onOpenEdition: none,
  onOpenDraft: none,
  onOpenAttempt: none,
  onMoreOwned: none,
  onMoreAttempts: none,
  onMorePublished: none,
};

// regression: content-library-scrolled-past-title — every list stacked in
// one column, so opening the last published puzzle scrolled the title out
// of view, and each saved attempt repeated "Your progress is kept at this
// edition." Playing and building are now separate tabs, and the note is
// said once for the section.
// regression: content-library-one-long-page — playing, finished attempts,
// publishing, drafts and playtests competed on one long page. Browse,
// Continue and My creations are tabs; finished attempts sit apart from
// the ones to continue.
// regression: library-engineer-copy — the note said "Each attempt keeps
// your progress at the edition you started". It now says it plainly.
test('browsing, continuing and building are separate tabs, the attempt note said once', () => {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="dark"
      fixedLayout={{ width: 1440, height: 900 }}
    >
      <ContentLibraryScreenView {...VIEW} />
    </ThemeProvider>
  ));
  const browse = screen.getByTestId('content-library-browse');
  const resume = screen.getByTestId('content-library-continue');
  const mine = screen.getByTestId('content-library-mine');
  expect(
    browse.contains(screen.getByTestId('content-published-revision-1'))
  ).toBe(true);
  expect(resume.contains(screen.getByTestId('content-attempt-attempt-1'))).toBe(
    true
  );
  expect(mine.contains(screen.getByTestId('content-draft-draft-1'))).toBe(true);
  expect(
    screen.getAllByText(
      'Each puzzle keeps your place, even if its author changes it later.'
    )
  ).toHaveLength(1);
  expect(
    screen.queryByText('Your progress is kept at this edition.')
  ).toBeNull();
  // Something is unfinished, so the library opens on Continue; the other
  // tabs are hidden until chosen.
  const tab = (value: string) =>
    screen.getByTestId(`content-library-tab-${value}`);
  expect(tab('continue').getAttribute('aria-selected')).toBe('true');
  expect(browse.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(
    true
  );
  tab('mine').click();
  expect(mine.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
  expect(resume.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(
    true
  );
});

// regression: library-continue-holds-finished — the Continue tab listed
// finished puzzles and private playtests beside the ones to pick up, so
// "Continue" did not mean what it said. It now holds only what is
// unfinished; what is solved is listed under Browse, after the puzzles it
// came from, and the playtests of the person's drafts under My creations.
// regression: library-sections-hang-left — wide, "Finished" and the
// playtests once hung in one column under a two-column list: the Continue
// tab now holds that one list alone.
test('Continue holds only what is unfinished; solved under Browse, playtests under My creations', () => {
  renderLibrary(VIEW);
  const resume = screen.getByTestId('content-library-continue');
  const browse = screen.getByTestId('content-library-browse');
  const mine = screen.getByTestId('content-library-mine');
  const section = (row: HTMLElement) =>
    row.closest('[data-component="PreviewCardGrid"]');
  const unfinished = screen.getByTestId('content-attempt-attempt-1');
  const finished = screen.getByTestId('content-attempt-attempt-2');
  const playtest = screen.getByTestId('content-attempt-playtest-1');
  expect(resume.contains(unfinished)).toBe(true);
  expect(resume.contains(finished)).toBe(false);
  expect(resume.contains(playtest)).toBe(false);
  expect(
    resume.querySelectorAll('[data-component="PreviewCardGrid"]')
  ).toHaveLength(1);
  expect(section(unfinished)?.textContent).toContain('Continue playing');
  expect(browse.contains(finished)).toBe(true);
  expect(section(finished)?.textContent?.startsWith('Solved')).toBe(true);
  expect(mine.contains(playtest)).toBe(true);
  expect(section(playtest)?.textContent).toContain('Playtests of your drafts');
  expect(section(playtest)?.textContent).toContain(
    "Practice runs don't count toward your progress."
  );
  expect(
    resume.querySelector('[data-testid="content-chip-status"]')
  ).toBeNull();
});

test('with nothing unfinished, Continue says so and the solved stay under Browse', () => {
  renderLibrary({
    ...VIEW,
    attempts: [{ id: 'attempt-2', title: 'Count to nine', completed: true }],
  });
  const resume = screen.getByTestId('content-library-continue');
  expect(resume.textContent).toContain('Nothing to continue yet');
  expect(
    screen
      .getByTestId('content-library-browse')
      .contains(screen.getByTestId('content-attempt-attempt-2'))
  ).toBe(true);
});

test('with nothing unfinished the library opens on Browse', () => {
  renderLibrary({
    ...VIEW,
    attempts: [{ id: 'attempt-2', title: 'Count to nine', completed: true }],
  });
  expect(
    screen
      .getByTestId('content-library-tab-browse')
      .getAttribute('aria-selected')
  ).toBe('true');
});

// regression: content-library-create-off-screen — on a phone the create
// controls sat at the end of the page, after every list. They come first,
// under the title, before any tab.
test('creating a puzzle or pack comes before the tabs on a phone', () => {
  renderLibrary({
    ...VIEW,
    createControls: <button type="button" data-testid="create" />,
  });
  const create = screen.getByTestId('create');
  const tabs = screen.getByTestId('content-library-tab');
  expect(
    (create.compareDocumentPosition(tabs) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
  ).toBe(true);
});

// Library cards lead with their picture filling the card's picture area,
// a pack's on stacked sheets (their alignment:
// pkgs/ui-root-harness-ts/tests/preview-thumbnail-stack).
test("every library card leads with its picture, a pack's stacked", () => {
  renderLibrary({
    ...VIEW,
    published: [
      { ...PUBLISHED_PUZZLE },
      { ...PUBLISHED_PUZZLE, id: 'revision-2', kind: 'pack' },
    ],
  });
  const thumbnails = ['revision-1', 'revision-2'].map((id) =>
    chip(screen.getByTestId(`content-published-${id}`), 'content-thumbnail')
  );
  expect(thumbnails.map((t) => t.getAttribute('data-size'))).toEqual([
    'fill',
    'fill',
  ]);
  expect(thumbnails[1]?.getAttribute('data-stacked')).toBe('true');
});

function renderLibrary(view: ContentLibraryScreenViewProps): void {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ContentLibraryScreenView {...view} />
    </ThemeProvider>
  ));
}

function chip(row: HTMLElement, testId: string): HTMLElement {
  const found = row.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (found === null) throw new Error(`${testId} is missing`);
  return found;
}

// regression: content-library-mixed-values — the library was all text, and
// one right-hand column mixed a difficulty ("Easy") with a kind ("Puzzle",
// "Pack") and a status ("Draft") as if they were one kind of value. Each
// row now leads with a picture of its board, and kind, difficulty and
// status are chips of three distinct looks.
test('rows lead with their board and keep kind, difficulty and status apart', () => {
  renderLibrary({
    ...VIEW,
    published: [
      {
        id: 'revision-1',
        document_id: 'document-1',
        kind: 'puzzle',
        title: 'Count to seven',
        description: '',
        difficulty: 'Easy',
        preview: 'board-7',
      },
      {
        id: 'revision-2',
        document_id: 'document-2',
        kind: 'pack',
        title: 'Weekend counts',
        description: '',
        difficulty: '',
      },
    ],
    renderPreview: (definition) => (
      <span data-testid={`preview-${definition}`}>{definition}</span>
    ),
  });
  const puzzle = screen.getByTestId('content-published-revision-1');
  const thumbnail = chip(puzzle, 'content-thumbnail');
  expect(thumbnail.querySelector('[data-testid="preview-board-7"]')).not.toBe(
    null
  );
  expect(thumbnail.getAttribute('aria-hidden')).toBe('true');
  expect(chip(puzzle, 'content-chip-kind').textContent).toBe('Puzzle');
  expect(chip(puzzle, 'content-chip-difficulty').textContent).toBe('Easy');
  const pack = screen.getByTestId('content-published-revision-2');
  expect(chip(pack, 'content-thumbnail').getAttribute('data-stacked')).toBe(
    'true'
  );
  expect(chip(pack, 'content-chip-kind').textContent).toBe('Pack');
  expect(pack.querySelector('[data-testid="content-chip-difficulty"]')).toBe(
    null
  );
  const draft = screen.getByTestId('content-draft-draft-1');
  expect(chip(draft, 'content-chip-status').textContent).toBe('Draft');
  const looks = new Set(
    [
      chip(puzzle, 'content-chip-kind'),
      chip(puzzle, 'content-chip-difficulty'),
      chip(draft, 'content-chip-status'),
    ].map((element) => element.getAttribute('data-intent'))
  );
  expect(looks.size).toBe(3);
});

// regression: library-pack-progress-unlabelled — a finished puzzle's card
// said "Weekend counts · Solved 1/3", which read as the puzzle's own
// progress though it counts the pack's puzzles. The line now says "Pack:
// Weekend counts · 1 of 3 solved", and a pack's own card "2 of 5 solved".
// regression: content-library-sparse-rows — each 960px row held a small
// thumbnail and a title and nothing else, and on a phone "Thirteen
// without …" was cut short beside an empty thumbnail box. Each card now
// shows the puzzle's difficulty and, for a pack or a puzzle started in
// one, how much of the pack is solved; titles wrap instead of being cut.
test('cards say difficulty and pack progress, and titles are never cut short', () => {
  renderLibrary({
    ...VIEW,
    attempts: [
      {
        id: 'attempt-1',
        title: 'Thirteen without overshooting, all the way',
        completed: false,
        difficulty: 'Medium',
        pack: { title: 'Weekend counts', completed: 1, total: 3 },
      },
      { id: 'attempt-3', title: 'Count to nine', completed: false },
      {
        id: 'attempt-4',
        title: 'Count to five',
        completed: true,
        pack: { title: 'Weekend counts', completed: 1, total: 3 },
      },
    ],
    published: [
      {
        ...PUBLISHED_PUZZLE,
        id: 'revision-2',
        kind: 'pack',
        difficulty: '',
        progress: { completed: 2, total: 5 },
      },
    ],
  });
  const attempt = screen.getByTestId('content-attempt-attempt-1');
  expect(attempt.getAttribute('data-component')).toBe('PreviewCard');
  expect(chip(attempt, 'content-chip-difficulty').textContent).toBe('Medium');
  expect(chip(attempt, 'content-progress').textContent).toBe(
    'Pack: Weekend counts · 1\u00a0of\u00a03\u00a0solved'
  );
  // Without a difficulty or a pack, a card shows neither.
  const plain = screen.getByTestId('content-attempt-attempt-3');
  expect(plain.querySelector('[data-testid="content-chip-difficulty"]')).toBe(
    null
  );
  expect(plain.querySelector('[data-testid="content-progress"]')).toBe(null);
  // regression: library-solved-progress-contradicts — a finished puzzle's
  // card read "Finished … 1 of 3 solved", as if it were itself unsolved.
  // Its line now says it is solved first, then where its pack stands.
  expect(
    chip(screen.getByTestId('content-attempt-attempt-4'), 'content-progress')
      .textContent
  ).toBe('Solved · 1\u00a0of\u00a03 in Weekend counts');
  const pack = screen.getByTestId('content-published-revision-2');
  expect(chip(pack, 'content-progress').textContent).toBe(
    '2\u00a0of\u00a05\u00a0solved'
  );
  for (const card of [attempt, plain, pack]) {
    const title = card.querySelector('.textRowTitle');
    expect(title?.className).not.toMatch(/line-clamp|truncate/);
  }
  expect(attempt.querySelector('.textRowTitle')?.textContent).toBe(
    'Thirteen without overshooting, all the way'
  );
});

// regression: library-creation-before-continue — the library's two
// outlined create buttons were the first content under its title, before
// the tabs and the list to continue, and Continue was the second tab.
// Creating is now the screen's own action at its title (`ScreenIntro`'s
// actions), Continue is the first tab, and its lists are compact rows at
// every width.
test('Continue leads the tabs, creating is a title action, and attempts are rows', () => {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="dark"
      fixedLayout={{ width: 1440, height: 900 }}
    >
      <ContentLibraryScreenView
        {...VIEW}
        createControls={<button type="button" data-testid="create" />}
      />
    </ThemeProvider>
  ));
  const tabs = [...document.querySelectorAll('[role="tab"]')].map((tab) =>
    tab.getAttribute('data-testid')
  );
  expect(tabs).toEqual([
    'content-library-tab-continue',
    'content-library-tab-browse',
    'content-library-tab-mine',
  ]);
  const actions = screen
    .getByTestId('create')
    .closest('[data-component="ScreenIntroActions"]');
  expect(actions?.closest('[data-component="ScreenIntro"]')).not.toBeNull();
  expect(
    screen
      .getByTestId('create')
      .closest('[data-testid^="content-library-"][role="tabpanel"]')
  ).toBeNull();
  const grids = [
    ...screen
      .getByTestId('content-library-continue')
      .querySelectorAll('[data-component="PreviewCardGrid"]'),
  ];
  expect(grids.length).toBeGreaterThan(0);
  for (const grid of grids)
    expect(grid.getAttribute('data-layout')).toBe('rows');
  expect(
    screen
      .getByTestId('content-library-browse')
      .querySelector('[data-component="PreviewCardGrid"]')
      ?.getAttribute('data-layout')
  ).toBe('cards');
});

// regression: library-difficulty-one-blue — "Easy" and "Medium" were the
// same blue tag, so how hard a puzzle is read only from its word. The usual
// words now take tints that climb with them (easy green, medium amber, hard
// red), and any other word an author chose stays the plain info tag.
test('difficulty tags take distinct tints that climb with how hard', () => {
  const difficulties = ['Easy', 'Medium', 'Hard', 'Tricky'];
  renderLibrary({
    ...VIEW,
    published: difficulties.map((difficulty, index) => ({
      ...PUBLISHED_PUZZLE,
      id: `revision-${index}`,
      difficulty,
    })),
  });
  const intents = difficulties.map((_, index) =>
    chip(
      screen.getByTestId(`content-published-revision-${index}`),
      'content-chip-difficulty'
    ).getAttribute('data-intent')
  );
  expect(intents).toEqual(['success', 'warning', 'destructive', 'info']);
});
