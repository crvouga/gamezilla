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
  expect(
    resume.contains(screen.getByTestId('content-attempt-playtest-1'))
  ).toBe(true);
  expect(mine.contains(screen.getByTestId('content-draft-draft-1'))).toBe(true);
  expect(
    screen.getAllByText(
      'Each attempt keeps your progress at the edition you started.'
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

test('finished attempts sit apart from the ones to continue, without status pills', () => {
  renderLibrary(VIEW);
  const unfinished = screen.getByTestId('content-attempt-attempt-1');
  const finished = screen.getByTestId('content-attempt-attempt-2');
  const section = (row: HTMLElement) =>
    row.closest('[data-component="PreviewCardGrid"]');
  expect(section(unfinished)).not.toBe(section(finished));
  expect(section(unfinished)?.textContent).toContain('Continue playing');
  expect(section(finished)?.textContent).toContain('Finished');
  expect(
    screen
      .getByTestId('content-library-continue')
      .querySelector('[data-testid="content-chip-status"]')
  ).toBeNull();
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
    'Weekend counts · Solved 1 of 3'
  );
  // Without a difficulty or a pack, a card shows neither.
  const plain = screen.getByTestId('content-attempt-attempt-3');
  expect(plain.querySelector('[data-testid="content-chip-difficulty"]')).toBe(
    null
  );
  expect(plain.querySelector('[data-testid="content-progress"]')).toBe(null);
  const pack = screen.getByTestId('content-published-revision-2');
  expect(chip(pack, 'content-progress').textContent).toBe('Solved 2 of 5');
  for (const card of [attempt, plain, pack]) {
    const title = card.querySelector('.textRowTitle');
    expect(title?.className).not.toMatch(/line-clamp|truncate/);
  }
  expect(attempt.querySelector('.textRowTitle')?.textContent).toBe(
    'Thirteen without overshooting, all the way'
  );
});
