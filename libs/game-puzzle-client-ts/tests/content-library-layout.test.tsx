/** @jsxImportSource solid-js */
/**
 * The puzzle library as small screens: a hub of rows, then one list each
 * (Continue, Solved, Browse, My creations, Playtests).
 */

import { afterEach, expect, test } from 'bun:test';
import {
  ContentLibraryScreenView,
  type ContentLibraryScreenViewProps,
} from '@libs/game-puzzle-client-ts/content-library-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

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
  place: { screen: 'library' },
  onOpen: none,
  title: 'Counting',
  create: { status: 'idle' },
  canCreatePuzzle: true,
  onCreate: none,
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

type Screen = ContentLibraryScreenViewProps['place']['screen'];

/** The library on one of its small screens. */
function renderPlace(
  place: Screen,
  view: Partial<ContentLibraryScreenViewProps> = {}
): void {
  renderLibrary({ ...VIEW, ...view, place: { screen: place } });
}

const LISTS = ['continue', 'solved', 'browse', 'mine', 'playtests'] as const;

// regression: content-library-scrolled-past-title — every list stacked in
// one column, so opening the last published puzzle scrolled the title out
// of view, and each saved attempt repeated "Your progress is kept at this
// edition."
// regression: content-library-one-long-page — playing, finished attempts,
// publishing, drafts and playtests competed on one long page, then on
// three tabs of several lists each. Each list is now a small screen of its
// own, reached by a row of the hub; no screen holds a second list.
// regression: library-engineer-copy — the note said "Each attempt keeps
// your progress at the edition you started". It now says it plainly, once.
test('each list is a screen of its own: one list, its note said once', () => {
  const rows: Record<(typeof LISTS)[number], string> = {
    continue: 'content-attempt-attempt-1',
    solved: 'content-attempt-attempt-2',
    browse: 'content-published-revision-1',
    mine: 'content-draft-draft-1',
    playtests: 'content-attempt-playtest-1',
  };
  for (const place of LISTS) {
    renderPlace(place);
    const list = screen.getByTestId(`content-library-${place}`);
    expect(list.contains(screen.getByTestId(rows[place]))).toBe(true);
    expect(
      list.querySelectorAll('[data-component="PreviewCardGrid"]')
    ).toHaveLength(1);
    // No other list, no hub row and no tabs share its screen.
    for (const other of LISTS.filter((entry) => entry !== place)) {
      expect(screen.queryByTestId(`content-library-${other}`)).toBeNull();
      expect(screen.queryByTestId(rows[other])).toBeNull();
    }
    expect(screen.queryByTestId('content-library-tab-browse')).toBeNull();
    expect(document.querySelector('[role="tab"]')).toBeNull();
    expect(
      document
        .querySelector('[data-component="EmbeddedScreen"]')
        ?.getAttribute('data-screen')
    ).toBe(`puzzle-content-library-${place}`);
    cleanup();
  }
  renderPlace('continue');
  expect(
    screen.getAllByText(
      'Each puzzle keeps your place, even if its author changes it later.'
    )
  ).toHaveLength(1);
  expect(
    screen.queryByText('Your progress is kept at this edition.')
  ).toBeNull();
});

// regression: library-continue-holds-finished — the Continue tab listed
// finished puzzles and private playtests beside the ones to pick up, so
// "Continue" did not mean what it said. It holds only what is unfinished;
// what is solved and the playtests of the person's drafts are lists of
// their own.
// regression: library-sections-hang-left — wide, "Finished" and the
// playtests once hung in one column under a two-column list: each list
// now stands alone on its screen.
test('Continue holds only what is unfinished; solved and playtests are their own lists', () => {
  const section = (row: HTMLElement) =>
    row.closest('[data-component="PreviewCardGrid"]');
  renderPlace('continue');
  const unfinished = screen.getByTestId('content-attempt-attempt-1');
  expect(section(unfinished)?.textContent).toContain('Continue playing');
  expect(screen.queryByTestId('content-attempt-attempt-2')).toBeNull();
  expect(screen.queryByTestId('content-attempt-playtest-1')).toBeNull();
  expect(
    screen
      .getByTestId('content-library-continue')
      .querySelector('[data-testid="content-chip-status"]')
  ).toBeNull();
  cleanup();
  renderPlace('solved');
  const finished = screen.getByTestId('content-attempt-attempt-2');
  expect(section(finished)?.textContent?.startsWith('Solved')).toBe(true);
  cleanup();
  renderPlace('playtests');
  const playtest = screen.getByTestId('content-attempt-playtest-1');
  expect(section(playtest)?.textContent).toContain('Playtests of your drafts');
  expect(section(playtest)?.textContent).toContain(
    "Practice runs don't count toward your progress."
  );
});

test('every list has its own empty state with a next action', () => {
  const opened: Screen[] = [];
  const empty = {
    drafts: [],
    attempts: [],
    playtests: [],
    published: [],
    onOpen: (place: ContentLibraryScreenViewProps['place']) =>
      opened.push(place.screen),
  };
  const states: Record<(typeof LISTS)[number], [string, string, Screen]> = {
    continue: ['Nothing to continue yet', 'Browse puzzles', 'browse'],
    solved: ['Nothing solved here yet', 'Browse puzzles', 'browse'],
    browse: ['No published puzzles loaded', 'Back to puzzles', 'library'],
    mine: ['Nothing built yet', 'Back to puzzles', 'library'],
    playtests: ['No playtests yet', 'My creations', 'mine'],
  };
  for (const place of LISTS) {
    renderPlace(place, empty);
    const [title, action] = states[place];
    const list = screen.getByTestId(`content-library-${place}`);
    expect(list.textContent).toContain(title);
    expect(list.querySelector('[data-component="PreviewCardGrid"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: action }));
    cleanup();
  }
  expect(opened).toEqual(LISTS.map((place) => states[place][2]));
});

test('each list loads its own next page', () => {
  const asked: string[] = [];
  const paged = {
    more: { owned: true, attempts: true, published: true },
    onMoreOwned: () => asked.push('owned'),
    onMoreAttempts: () => asked.push('attempts'),
    onMorePublished: () => asked.push('published'),
  };
  const labels: Record<(typeof LISTS)[number], string> = {
    continue: 'Load earlier attempts',
    solved: 'Load earlier attempts',
    browse: 'Load more published puzzles and packs',
    mine: 'Load more of your drafts and publications',
    playtests: 'Load earlier attempts',
  };
  for (const place of LISTS) {
    renderPlace(place, paged);
    const buttons = screen
      .getAllByRole('button')
      .filter((button) => /^Load /.test(button.textContent ?? ''));
    expect(buttons.map((button) => button.textContent)).toEqual([
      labels[place],
    ]);
    fireEvent.click(buttons[0] as HTMLElement);
    cleanup();
  }
  expect(asked).toEqual([
    'attempts',
    'attempts',
    'published',
    'owned',
    'attempts',
  ]);
});

// regression: content-library-create-off-screen — on a phone the create
// controls sat at the end of the page, after every list. They are rows of
// the hub, with the lists they sit beside.
// regression: library-creation-before-continue — the library's two
// outlined create buttons were the first content under its title, before
// the list to continue. On the hub Continue leads, creating comes with
// what the person makes, and every row says how much it holds.
test('the hub leads with Continue, counts each list, and creates from rows', () => {
  const opened: Screen[] = [];
  const created: string[] = [];
  renderPlace('library', {
    bundledPacks: [
      {
        id: 'bundled-r1',
        document_id: 'bundled-1',
        kind: 'pack',
        title: 'Starter pack',
        description: '',
        difficulty: '',
        progress: { completed: 2, total: 5 },
      },
    ],
    more: { owned: false, attempts: false, published: true },
    onOpen: (place) => opened.push(place.screen),
    onCreate: (kind) => created.push(kind),
  });
  const rows = [...document.querySelectorAll('[data-component="MenuRow"]')].map(
    (row) => row.getAttribute('data-testid')
  );
  expect(rows).toEqual([
    'content-library-tab-continue',
    'content-library-tab-solved',
    'content-library-tab-browse',
    'content-bundled-bundled-1',
    'content-library-tab-mine',
    'content-library-tab-playtests',
    'content-create-puzzle',
    'content-create-pack',
  ]);
  const value = (testid: string) => screen.getByTestId(testid).textContent;
  expect(value('content-library-tab-continue')).toContain('1');
  expect(value('content-library-tab-solved')).toContain('1');
  expect(value('content-library-tab-browse')).toContain('1+');
  expect(value('content-library-tab-mine')).toContain('1');
  expect(value('content-bundled-bundled-1')).toContain('2 of 5 solved');
  // The hub holds rows only: no list, no card, no filled command.
  expect(
    document.querySelector('[data-component="PreviewCardGrid"]')
  ).toBeNull();
  expect(
    document
      .querySelector('[data-component="EmbeddedScreen"]')
      ?.getAttribute('data-screen')
  ).toBe('puzzle-content-library');
  for (const list of ['continue', 'solved', 'browse', 'mine', 'playtests'])
    fireEvent.click(screen.getByTestId(`content-library-tab-${list}`));
  expect(opened).toEqual(['continue', 'solved', 'browse', 'mine', 'playtests']);
  fireEvent.click(screen.getByTestId('content-create-puzzle'));
  fireEvent.click(screen.getByTestId('content-create-pack'));
  expect(created).toEqual(['puzzle', 'pack']);
});

test('the hub hides Solved and Playtests while there is nothing in them', () => {
  renderPlace('library', {
    attempts: [],
    playtests: [],
    published: [],
    drafts: [],
  });
  expect(screen.queryByTestId('content-library-tab-solved')).toBeNull();
  expect(screen.queryByTestId('content-library-tab-playtests')).toBeNull();
  for (const list of ['continue', 'browse', 'mine'])
    expect(
      screen.getByTestId(`content-library-tab-${list}`).textContent
    ).toContain('None yet');
});

test('creating is one named state: a spinner on its row, the others waiting, then the draft to open', () => {
  const opened: string[] = [];
  renderPlace('library', { create: { status: 'creating', kind: 'pack' } });
  const disabled = (testid: string) =>
    (screen.getByTestId(testid) as HTMLButtonElement).disabled;
  expect(
    screen
      .getByTestId('content-create-pack')
      .querySelector('[data-component="Spinner"]')
  ).not.toBeNull();
  expect(
    screen
      .getByTestId('content-create-puzzle')
      .querySelector('[data-component="Spinner"]')
  ).toBeNull();
  for (const row of [
    'content-library-tab-continue',
    'content-library-tab-browse',
    'content-library-tab-mine',
    'content-create-puzzle',
    'content-create-pack',
  ])
    expect(disabled(row)).toBe(true);
  expect(screen.queryByTestId('content-open-created-draft')).toBeNull();
  cleanup();
  renderPlace('library', {
    create: { status: 'created', kind: 'pack', documentId: 'doc-new' },
    onOpenDraft: (id) => opened.push(id),
  });
  expect(disabled('content-create-pack')).toBe(false);
  fireEvent.click(screen.getByTestId('content-open-created-draft'));
  expect(opened).toEqual(['doc-new']);
});

test('a draft that could not be created is said on every library screen, with its retry', () => {
  for (const place of ['library', ...LISTS] as const) {
    const retried: string[] = [];
    renderPlace(place, {
      create: { status: 'failed', kind: 'pack', message: 'No room left.' },
      onCreate: (kind) => retried.push(kind),
    });
    const notice = screen.getByTestId('content-create-failed');
    expect(notice.textContent).toContain('Your draft was not created');
    expect(notice.textContent).toContain('No room left.');
    fireEvent.click(
      notice.querySelector('button') ??
        screen.getByRole('button', { name: /try again|retry/i })
    );
    expect(retried).toEqual(['pack']);
    cleanup();
  }
});

test('someone who may not create is told so instead of the create rows', () => {
  renderPlace('library', {
    createDenial: {
      icon: KeyRoundIcon,
      title: 'Sign in to create puzzles',
      dataSet: { testid: 'permission-denial', reason: 'requires_account' },
    },
  });
  expect(screen.queryByTestId('content-create-puzzle')).toBeNull();
  expect(screen.queryByTestId('content-create-pack')).toBeNull();
  expect(screen.getByTestId('permission-denial').textContent).toContain(
    'Sign in to create puzzles'
  );
});

// Library cards lead with their picture filling the card's picture area,
// a pack's on stacked sheets (their alignment:
// pkgs/ui-root-harness-ts/tests/preview-thumbnail-stack).
test("every library card leads with its picture, a pack's stacked", () => {
  renderPlace('browse', {
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
  const view: Partial<ContentLibraryScreenViewProps> = {
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
  };
  renderPlace('browse', view);
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
  const looks = [
    chip(puzzle, 'content-chip-kind'),
    chip(puzzle, 'content-chip-difficulty'),
  ].map((element) => element.getAttribute('data-intent'));
  cleanup();
  renderPlace('mine', view);
  const draft = screen.getByTestId('content-draft-draft-1');
  expect(chip(draft, 'content-chip-status').textContent).toBe('Draft');
  looks.push(chip(draft, 'content-chip-status').getAttribute('data-intent'));
  expect(new Set(looks).size).toBe(3);
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
  const view: Partial<ContentLibraryScreenViewProps> = {
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
  };
  renderPlace('continue', view);
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
  const titles = [attempt, plain].map(
    (card) => card.querySelector('.textRowTitle')?.className ?? ''
  );
  expect(attempt.querySelector('.textRowTitle')?.textContent).toBe(
    'Thirteen without overshooting, all the way'
  );
  cleanup();
  renderPlace('solved', view);
  // regression: library-solved-progress-contradicts — a finished puzzle's
  // card read "Finished … 1 of 3 solved", as if it were itself unsolved.
  // Its line now says it is solved first, then where its pack stands.
  expect(
    chip(screen.getByTestId('content-attempt-attempt-4'), 'content-progress')
      .textContent
  ).toBe('Solved · 1\u00a0of\u00a03 in Weekend counts');
  cleanup();
  renderPlace('browse', view);
  const pack = screen.getByTestId('content-published-revision-2');
  expect(chip(pack, 'content-progress').textContent).toBe(
    '2\u00a0of\u00a05\u00a0solved'
  );
  titles.push(pack.querySelector('.textRowTitle')?.className ?? '');
  expect(titles).toHaveLength(3);
  for (const title of titles) {
    expect(title).toContain('textRowTitle');
    expect(title).not.toMatch(/line-clamp|truncate/);
  }
});

test('attempts are compact rows at every width, published content is cards', () => {
  for (const place of ['continue', 'solved', 'playtests'] as const) {
    renderWide(place);
    expect(
      screen
        .getByTestId(`content-library-${place}`)
        .querySelector('[data-component="PreviewCardGrid"]')
        ?.getAttribute('data-layout')
    ).toBe('rows');
    cleanup();
  }
  for (const place of ['browse', 'mine'] as const) {
    renderWide(place);
    expect(
      screen
        .getByTestId(`content-library-${place}`)
        .querySelector('[data-component="PreviewCardGrid"]')
        ?.getAttribute('data-layout')
    ).toBe('cards');
    cleanup();
  }
});

function renderWide(place: Screen): void {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="dark"
      fixedLayout={{ width: 1440, height: 900 }}
    >
      <ContentLibraryScreenView {...VIEW} place={{ screen: place }} />
    </ThemeProvider>
  ));
}

// regression: library-difficulty-one-blue — "Easy" and "Medium" were the
// same blue tag, so how hard a puzzle is read only from its word. The usual
// words now take tints that climb with them (easy green, medium amber, hard
// red), and any other word an author chose stays the plain info tag.
test('difficulty tags take distinct tints that climb with how hard', () => {
  const difficulties = ['Easy', 'Medium', 'Hard', 'Tricky'];
  renderPlace('browse', {
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

// regression: library-continue-sparse-desktop — wide, a Continue tab with
// two unfinished puzzles was two cards and then an empty page, later
// padded with Browse's picks under "More to play". Continue is now one
// list on its own screen: it never repeats Browse, and with nothing to
// continue it says so and leads to Browse.
test('Continue never borrows from Browse; empty, it leads there', () => {
  const opened: Screen[] = [];
  renderPlace('continue');
  expect(screen.queryByTestId('content-library-more-to-play')).toBeNull();
  expect(screen.queryByTestId('content-published-revision-1')).toBeNull();
  expect(screen.queryByText('More to play')).toBeNull();
  cleanup();
  renderPlace('continue', {
    attempts: [{ id: 'attempt-2', title: 'Count to nine', completed: true }],
    onOpen: (place) => opened.push(place.screen),
  });
  const list = screen.getByTestId('content-library-continue');
  expect(list.textContent).toContain('Nothing to continue yet');
  expect(screen.queryByTestId('content-attempt-attempt-2')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Browse puzzles' }));
  expect(opened).toEqual(['browse']);
});
