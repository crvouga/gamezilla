/** @jsxImportSource solid-js */
/** Publishing reads as one sequence of steps with one next action. */

import { afterEach, expect, test } from 'bun:test';
import {
  ContentAuthorScreenView,
  type ContentAuthorScreenViewProps,
} from '@libs/game-puzzle-client-ts/content-author-screen-view';
import {
  ContentPublicationControlsView,
  type ContentPublicationControlsViewProps,
} from '@libs/game-puzzle-client-ts/content-publication-controls-view';
import type { ContentPublicationCopyState } from '@libs/game-puzzle-client-ts/content-publication-copy-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

afterEach(cleanup);

const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;
const resolved = async (): Promise<void> => undefined;

function mount(
  ui: () => JSX.Element,
  size: { width: number; height: number } = DESKTOP
): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={size}>
        {ui()}
      </ThemeProvider>
    </ClockProvider>
  ));
}

function publication(
  overrides: Partial<ContentPublicationControlsViewProps> = {}
): JSX.Element {
  return (
    <ContentPublicationControlsView
      copyState={{ kind: 'draft' }}
      kind="puzzle"
      validation="unchecked"
      validationMessage=""
      proven={false}
      pending={null}
      published={false}
      disabled={false}
      before={(next) => (
        <button
          type="button"
          data-testid="playtest"
          data-variant={next() ? 'solid' : 'outline'}
        />
      )}
      onValidate={resolved}
      onPublish={resolved}
      onViewPublication={() => undefined}
      onWithdraw={() => undefined}
      {...overrides}
    />
  );
}

/** Each step's key-free state, in the order the track reads. */
function states(): (string | null)[] {
  return [
    ...screen.getByTestId('content-publication-steps').querySelectorAll('li'),
  ].map((step) => step.getAttribute('data-state'));
}

/** The filled action over the track, outside it. */
function lead(): HTMLElement {
  const track = screen.getByTestId('content-publication-steps');
  const solid = [
    ...document.querySelectorAll<HTMLElement>('[data-variant="solid"]'),
  ].filter((button) => !track.contains(button));
  expect(solid.length).toBe(1);
  const only = solid[0];
  if (only === undefined) throw new Error('no lead action');
  return only;
}

// regression: builder-publish-states-scattered — where a draft stood was
// spread over a proof phrase, a check phrase and a hint, with three
// buttons beside them, so publishing read as a scatter of states. It is
// now one track of steps in order (playtest, validate, publish), each
// marked done, next or later, under one line naming the next step.
test("a puzzle's steps read in order, each marked done, next or later", () => {
  mount(() => publication({ proven: true }));
  const track = screen.getByTestId('content-publication-steps');
  expect(track.getAttribute('data-component')).toBe('StepTrack');
  expect(states()).toEqual(['done', 'current', 'upcoming']);
  const steps = [...track.querySelectorAll('li')];
  expect(steps[0]?.contains(screen.getByTestId('playtest'))).toBe(true);
  expect(steps[1]?.textContent).toContain('Validate');
  expect(steps[2]?.contains(screen.getByTestId('content-publish'))).toBe(true);
  expect(steps[1]?.getAttribute('aria-current')).toBe('step');
  expect(screen.getByTestId('content-publication-status').textContent).toBe(
    'Next: validate the draft, then publish it.'
  );
});

// regression: builder-no-dominant-next-action — the next step's action
// sat inside the track among the others, so publishing read as three
// equal steps to work out (and a pack's next step had no action at all).
// The next step's action now leads, filled, over the track, outside it,
// with the line saying why beside it.
test('the next step leads, filled, over the steps', () => {
  mount(() => publication({ proven: true }));
  expect(lead()).toBe(screen.getByTestId('content-validate'));
  const status = screen.getByTestId('content-publication-status');
  const track = screen.getByTestId('content-publication-steps');
  const follows = (a: Element, b: Element): boolean =>
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  expect(follows(lead(), status)).toBe(true);
  expect(follows(status, track)).toBe(true);
});

// regression: builder-wide-lead-cut-at-fold — wide, the line naming the
// next step sat on a row of its own over the lead action, so under the
// Sokoban editor's board the filled action was cut by the window's foot.
// The lead and the line saying why now share one row (the line wraps
// under the action where the row is narrow).
test('the lead action and the line saying why share one row', () => {
  mount(() => publication({ proven: true }));
  const status = screen.getByTestId('content-publication-status');
  expect(lead().parentElement).toBe(status.parentElement);
  expect(status.parentElement?.className).toContain('flex-wrap');
});

test('a checked, proven puzzle has Publish as its one next step', () => {
  mount(() => publication({ proven: true, validation: 'valid' }));
  expect(states()).toEqual(['done', 'done', 'current']);
  expect(screen.getByTestId('content-validation-passed')).toBeDefined();
  expect(lead()).toBe(screen.getByTestId('content-publish'));
});

// regression: builder-locked-steps-look-enabled — before the playtest,
// Validate and Publish were full-contrast outlined buttons beside the
// filled step, so a step that could not happen yet looked ready. A step
// that waits is now locked: muted, behind a lock, saying so, and still
// pressable, so pressing Publish says what is missing.
// regression: builder-stepper-hard-to-parse — each waiting step also said
// what it waited on ("Validate After the playtest · Publish After
// validation"), so the track read as one run-on line. Each step now reads
// as number, name and state: "2 Validate · Locked".
test('steps that wait are locked, say so in a word, and still press', async () => {
  let published = 0;
  mount(() =>
    publication({
      onPublish: async () => {
        published += 1;
      },
    })
  );
  expect(states()).toEqual(['current', 'upcoming', 'upcoming']);
  expect(lead()).toBe(screen.getByTestId('playtest'));
  const steps = [
    ...screen.getByTestId('content-publication-steps').querySelectorAll('li'),
  ];
  for (const [index, id, line] of [
    [1, 'content-validate', '2Validate·Locked'],
    [2, 'content-publish', '3Publish·Locked'],
  ] as const) {
    const button = screen.getByTestId(id);
    expect(button.getAttribute('data-face')).toBe('locked');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.querySelector('svg')).not.toBeNull();
    expect(steps[index]?.textContent).toBe(line);
    expect(steps[index]?.textContent).not.toContain('After');
  }
  fireEvent.click(screen.getByTestId('content-publish'));
  await Promise.resolve();
  expect(published).toBe(1);
});

// regression: pack-builder-blocker-unnamed — a pack with a puzzle still a
// draft said "Not checked yet. Validate, then publish." with Validate
// filled, though the pack could not publish until that puzzle was. Its
// first step is now publishing its puzzles, counted in the next-step
// line, and its lead names and opens that puzzle; the pack's own steps
// are locked.
test('a pack waits on its draft puzzles first, names them, and opens the first', () => {
  let opened = 0;
  mount(() =>
    publication({
      kind: 'pack',
      before: undefined,
      waitingOn: ['Count to nine'],
      onOpenWaiting: () => {
        opened += 1;
      },
    })
  );
  expect(states()).toEqual(['current', 'upcoming', 'upcoming']);
  expect(screen.getByTestId('content-pack-puzzles-step').textContent).toBe(
    '1Publish puzzles·Next'
  );
  // regression: pack-publish-dependency-exposed — the line explained the
  // rule ("A pack holds only published puzzles, so Count to nine comes
  // first") instead of where the pack stood. It now says it plainly.
  expect(screen.getByTestId('content-publication-status').textContent).toBe(
    '1 puzzle is still a draft. Publish it, then the pack.'
  );
  expect(lead()).toBe(screen.getByTestId('content-open-waiting'));
  // regression: pack-lead-awkward-wording — the lead read "Open Count to
  // nine to publish it", then "Publish Count to nine first". It now names
  // the one thing to do, in plain words.
  expect(lead().textContent).toBe('Finish Count to nine');
  fireEvent.click(lead());
  expect(opened).toBe(1);
  for (const id of ['content-validate', 'content-publish'])
    expect(screen.getByTestId(id).getAttribute('data-face')).toBe('locked');
  const steps = [
    ...screen.getByTestId('content-publication-steps').querySelectorAll('li'),
  ];
  expect(steps[1]?.textContent).toBe('2Validate·Locked');
  expect(steps[2]?.textContent).toBe('3Publish·Locked');
});

// regression: builder-playtest-next-while-unplayable
test('a draft the game cannot play names its corrections, not the playtest, as next', () => {
  mount(() => publication({ playable: false }));
  expect(screen.getByTestId('content-publication-status').textContent).toBe(
    'Next: fix the draft as the editor says, then playtest.'
  );
  const playtest = screen
    .getByTestId('content-publication-steps')
    .querySelector('li');
  expect(playtest?.getAttribute('data-state')).toBe('current');
  expect(playtest?.textContent).toBe('1Playtest·Fix first');
});

function builder(
  overrides: Partial<ContentAuthorScreenViewProps> = {}
): JSX.Element {
  return (
    <ContentAuthorScreenView
      status="ready"
      documentId="doc-1"
      kind="puzzle"
      body={{
        title: 'Two crates',
        description: 'Push both crates.',
        difficulty: 'Easy',
        definition: '',
      }}
      save={{ saving: false, dirty: false, error: null }}
      conflicted={false}
      metadataDisabled={false}
      disabled={false}
      place={{ screen: 'publish' }}
      onOpen={() => undefined}
      standing={{ kind: 'playtest' }}
      publication={publication({
        before: (next) => (
          <button
            type="button"
            data-testid="playtest"
            data-variant={next() ? 'solid' : 'outline'}
          />
        ),
      })}
      stage={<span data-testid="editor" />}
      onChangeBody={() => undefined}
      onSaveAgain={() => undefined}
      onReturnToLibrary={() => undefined}
      {...overrides}
    />
  );
}

// regression: builder-phone-next-step-below-fold — on a phone the
// builder's playtest and publishing started below the board, the tools and
// the board's size, outside the first screen, with nothing near the top
// saying they were there.
// regression: builder-phone-next-action-quiet — then a quiet link near
// the top only named the next step and scrolled to it.
// regression: builder-phone-publish-card-buries-stage — then the publish
// step was an unnumbered card between "1 · Details" and "2 · Board", so
// the steps read out of order and the board started under the fold. The
// builder's hub now holds no board at all: its steps in order and, filled,
// the one next step, which opens the publish screen where the step is
// taken. Phone and desktop show the same screens.
for (const [size, name] of [
  [PHONE, 'a phone'],
  [DESKTOP, 'a desktop'],
] as const)
  test(`on ${name} the hub's one filled command is the next step, and it opens the publish screen`, () => {
    const opened: string[] = [];
    mount(
      () =>
        builder({
          place: { screen: 'builder' },
          onOpen: (place) => opened.push(place.screen),
        }),
      size
    );
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(screen.queryByTestId('content-author-publish')).toBeNull();
    const next = screen.getByTestId('content-author-next');
    expect(next.getAttribute('data-variant')).toBe('solid');
    expect(next.textContent).toBe('Next: playtest');
    expect(
      document.querySelectorAll(
        '[data-component="Button"][data-variant="solid"]'
      )
    ).toHaveLength(1);
    // It follows the steps it continues, in the flow, never in the title row.
    expect(
      screen.getByTestId('content-author-steps').compareDocumentPosition(next) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      document.querySelector('[data-component="ScreenIntroActions"]')
    ).toBeNull();
    fireEvent.click(next);
    expect(opened).toEqual(['publish']);
  });

for (const [size, name] of [
  [PHONE, 'a phone'],
  [DESKTOP, 'a desktop'],
] as const)
  test(`on ${name} the publish screen holds the lead, why it is next, and the steps in order`, () => {
    mount(() => builder(), size);
    const publish = screen.getByTestId('content-author-publish');
    const playtest = screen.getByTestId('playtest');
    expect(lead()).toBe(playtest);
    expect(publish.contains(playtest)).toBe(true);
    expect(
      publish.contains(screen.getByTestId('content-publication-status'))
    ).toBe(true);
    expect(
      publish.contains(screen.getByTestId('content-publication-steps'))
    ).toBe(true);
    expect(
      document.querySelector('[data-component="ScreenIntroActions"]')
    ).toBeNull();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

// regression: publication-current-copy-status-ambiguous
// State inputs match the existing PublishPending/Published fixtures.
test('pending becomes an edition then an edited draft without duplicate publication leads', () => {
  const [state, setState] = createSignal<ContentPublicationCopyState>({
    kind: 'pending',
    connection: 'online',
  });
  mount(() =>
    publication({
      validation: 'valid',
      proven: true,
      published: true,
      get copyState() {
        return state();
      },
      get pending() {
        return state().kind === 'pending' ? 'online' : null;
      },
    })
  );
  expect(screen.getByTestId('content-publish')).toHaveTextContent('Send again');
  expect(screen.getAllByTestId('content-publication-status')).toHaveLength(1);
  expect(
    screen.getAllByText('Awaiting confirmation', { exact: true })
  ).toHaveLength(1);
  expect(screen.getByTestId('content-publication-status')).toHaveTextContent(
    'Awaiting confirmation'
  );
  expect(
    screen.queryByText('Ready: publish to share it with everyone who plays.')
  ).toBeNull();
  setState({ kind: 'edition', current: true });
  expect(screen.getByTestId('content-publish')).toHaveTextContent('Send again');
  expect(screen.getAllByTestId('content-view-publication')).toHaveLength(1);
  expect(screen.getAllByTestId('content-publication-status')).toHaveLength(1);
  expect(screen.getAllByText('Published', { exact: true })).toHaveLength(1);
  expect(screen.getByTestId('content-publication-status')).toHaveTextContent(
    'Published'
  );
  setState({ kind: 'draft' });
  expect(screen.getByTestId('content-publish')).toHaveTextContent('Publish');
  expect(screen.getAllByTestId('content-view-publication')).toHaveLength(1);
});

test('a newer draft keeps Publish while an earlier publication waits', () => {
  // regression: publication-current-copy-status-ambiguous
  mount(() =>
    publication({
      validation: 'valid',
      proven: true,
      copyState: { kind: 'draft' },
      pending: 'offline',
      published: true,
    })
  );
  expect(screen.getByTestId('content-publish')).toHaveTextContent('Publish');
  expect(screen.getByTestId('content-publish')).toBeEnabled();
  expect(screen.getByTestId('content-publication-pending')).toHaveTextContent(
    'waits for your connection'
  );
  expect(screen.getByTestId('content-view-publication')).toBeInTheDocument();
});

test('receipt hydration is explicit and does not announce optimistic publication as complete', () => {
  // regression: publication-current-copy-status-ambiguous
  const [state, setState] = createSignal<ContentPublicationCopyState>({
    kind: 'reading',
  });
  mount(() =>
    publication({
      validation: 'valid',
      proven: true,
      get copyState() {
        return state();
      },
    })
  );
  expect(screen.getByTestId('content-publish')).toBeDisabled();
  expect(screen.getByTestId('content-publication-status')).toHaveTextContent(
    'Checking publication'
  );
  setState({ kind: 'pending', connection: 'offline' });
  expect(screen.getByTestId('content-publish')).toBeEnabled();
  expect(screen.getByTestId('content-publication-status')).toHaveTextContent(
    'Waiting for connection'
  );
});

test('repeating a waiting publication still invokes the existing operation once', async () => {
  let calls = 0;
  mount(() =>
    publication({
      validation: 'valid',
      proven: true,
      pending: 'offline',
      copyState: { kind: 'pending', connection: 'offline' },
      onPublish: async () => {
        calls += 1;
      },
    })
  );
  expect(calls).toBe(0);
  fireEvent.click(screen.getByTestId('content-publish'));
  await waitFor(() => expect(calls).toBe(1));
});

test('a refused publication retains the retry callback, under the shell\'s refusal explanation', async () => {
  let calls = 0;
  mount(() =>
    builder({
      standing: { kind: 'publish' },
      refusal: <span>Earlier publication was refused.</span>,
      publication: publication({
        validation: 'valid',
        proven: true,
        copyState: { kind: 'draft' },
        onPublish: async () => {
          calls += 1;
          if (calls === 1) throw new Error('The pack puzzle is unavailable.');
        },
      }),
    })
  );
  fireEvent.click(screen.getByTestId('content-publish'));
  await waitFor(() =>
    expect(screen.getByTestId('content-publish')).toHaveTextContent(
      'Try publishing again'
    )
  );
  expect(
    screen.getByText('Earlier publication was refused.')
  ).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('content-publish'));
  await waitFor(() => expect(calls).toBe(2));
});

for (const current of [true, false]) {
  test(`an unchanged edition keeps the idempotent repeat action, current=${current}`, async () => {
    let calls = 0;
    mount(() =>
      publication({
        validation: 'valid',
        proven: true,
        published: true,
        copyState: { kind: 'edition', current },
        onPublish: async () => {
          calls += 1;
        },
      })
    );
    const repeat = screen.getByTestId('content-publish');
    expect(repeat).toHaveTextContent('Send again');
    expect(screen.getByTestId('content-publication-status')).toHaveTextContent(
      current ? 'Published' : 'Previously published'
    );
    fireEvent.click(repeat);
    await waitFor(() => expect(calls).toBe(1));
  });
}

// regression: builder-unopenable-draft-told-to-correct
test('the next step for a draft the game cannot play does not promise corrections the editor may not list', () => {
  mount(() => publication({ playable: false }));
  const status = screen.getByTestId('content-publication-status').textContent;
  expect(status).not.toContain('corrections');
  expect(status).toBe('Next: fix the draft as the editor says, then playtest.');
});

// regression: builder-preview-open-while-unplayable
test('Preview waits while the game cannot play the draft', () => {
  mount(() => builder({ place: { screen: 'builder' }, previewable: false }));
  expect(screen.getByTestId('content-preview').hasAttribute('disabled')).toBe(
    true
  );
  cleanup();
  mount(() => builder({ place: { screen: 'builder' } }));
  expect(screen.getByTestId('content-preview').hasAttribute('disabled')).toBe(
    false
  );
});

test('withdrawing only asks: the confirmation belongs to the shell', () => {
  let asked = 0;
  mount(() =>
    publication({
      validation: 'valid',
      proven: true,
      published: true,
      copyState: { kind: 'edition', current: true },
      onWithdraw: () => {
        asked += 1;
      },
    })
  );
  fireEvent.click(screen.getByTestId('content-withdraw'));
  expect(asked).toBe(1);
  expect(screen.queryByTestId('content-withdraw-confirm')).toBeNull();
});
