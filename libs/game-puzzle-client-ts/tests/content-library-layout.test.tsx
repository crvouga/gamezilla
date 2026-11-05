/** @jsxImportSource solid-js */
/** The puzzle library: playing in one column, building in the other, said once. */

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
// edition." Playing and building are now two columns, and the note is said
// once for the section.
test('playing and building are separate columns, the attempt note said once', () => {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="dark"
      fixedLayout={{ width: 1440, height: 900 }}
    >
      <ContentLibraryScreenView {...VIEW} />
    </ThemeProvider>
  ));
  const play = screen.getByTestId('content-library-play');
  const create = screen.getByTestId('content-library-create');
  expect(play.contains(screen.getByTestId('content-attempt-attempt-1'))).toBe(
    true
  );
  expect(
    play.contains(screen.getByTestId('content-published-revision-1'))
  ).toBe(true);
  expect(create.contains(screen.getByTestId('content-draft-draft-1'))).toBe(
    true
  );
  expect(
    create.contains(screen.getByTestId('content-attempt-playtest-1'))
  ).toBe(true);
  expect(
    screen.getAllByText(
      'Each attempt keeps your progress at the edition you started.'
    )
  ).toHaveLength(1);
  expect(
    screen.queryByText('Your progress is kept at this edition.')
  ).toBeNull();
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
