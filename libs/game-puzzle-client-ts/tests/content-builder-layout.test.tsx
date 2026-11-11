/** @jsxImportSource solid-js */
/**
 * The puzzle and pack builders as small screens: a hub of steps with one
 * next step, then a screen each for the details, the board, the preview,
 * publishing and the draft copies, all under one shell.
 */

import { afterEach, expect, test } from 'bun:test';
import {
  ContentAuthorScreenView,
  type ContentAuthorScreenViewProps,
} from '@libs/game-puzzle-client-ts/content-author-screen-view';
import type { ContentBuilderStanding } from '@libs/game-puzzle-client-ts/content-builder-standing';
import {
  ContentPackEditorView,
  ContentPackItemRow,
} from '@libs/game-puzzle-client-ts/content-pack-editor-view';
import {
  ContentPublicationControlsView,
  type ContentPublicationControlsViewProps,
} from '@libs/game-puzzle-client-ts/content-publication-controls-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

afterEach(cleanup);

const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;

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

const resolved = async (): Promise<void> => undefined;

function publication(
  overrides: Partial<ContentPublicationControlsViewProps> = {}
): JSX.Element {
  return (
    <ContentPublicationControlsView
      copyState={{ kind: 'draft' }}
      kind="pack"
      validation="unchecked"
      validationMessage=""
      proven={false}
      pending={null}
      published={false}
      disabled={false}
      onValidate={resolved}
      onPublish={resolved}
      onViewPublication={() => undefined}
      onWithdraw={() => undefined}
      {...overrides}
    />
  );
}

function variants(): { validate: string | null; publish: string | null } {
  return {
    validate: screen
      .getByTestId('content-validate')
      .getAttribute('data-variant'),
    publish: screen.getByTestId('content-publish').getAttribute('data-variant'),
  };
}

// regression: content-builder-two-primary-actions — Validate and Publish
// were both filled, so the builder offered two equally loud next steps.
// regression: builder-publish-three-button-weights — then the next step
// was filled, Publish a text-only ghost and the other steps outlined, so
// one tier of action came in three weights. Exactly one step is filled:
// the next one.
test('until the draft passes its check, Validate is the one filled step', () => {
  mount(() => publication());
  expect(variants().validate).toBe('solid');
  expect(variants().publish).not.toBe('solid');
});

test('once the draft passes its check, Publish is the one filled step', () => {
  mount(() => publication({ validation: 'valid' }));
  expect(variants()).toEqual({ validate: 'outline', publish: 'solid' });
});

// regression: builder-publish-looks-ready-early — a Sokoban draft said
// "Finish a playtest, then validate" while Validate was the filled button
// and Publish an outline beside it, as available as any other step. The
// playtest is now the one filled step until it proves the puzzle, and
// Publish is never filled before the draft passes its check; the steps'
// track marks it a later step.
test('until a playtest proves a puzzle, the playtest is the one filled step', () => {
  const next: boolean[] = [];
  mount(() =>
    publication({
      kind: 'puzzle',
      before: (isNext) => {
        next.push(isNext());
        return <span data-testid="playtest" />;
      },
    })
  );
  expect(next).toEqual([true]);
  expect(variants().validate).not.toBe('solid');
  expect(variants().publish).not.toBe('solid');
});

test('a proven puzzle not yet checked fills Validate, and Publish stays quiet', () => {
  const next: boolean[] = [];
  mount(() =>
    publication({
      kind: 'puzzle',
      proven: true,
      before: (isNext) => {
        next.push(isNext());
        return <span data-testid="playtest" />;
      },
    })
  );
  expect(next).toEqual([false]);
  expect(variants().validate).toBe('solid');
  expect(variants().publish).not.toBe('solid');
});

function row(
  id: string,
  first: boolean,
  last: boolean,
  onOpen: () => void = () => undefined
): JSX.Element {
  return (
    <ContentPackItemRow
      id={id}
      title={`Puzzle ${id}`}
      caption=""
      status="published"
      first={first}
      last={last}
      disabled={false}
      open="edit"
      onOpen={onOpen}
      onUp={() => undefined}
      onDown={() => undefined}
      onRemove={() => undefined}
    />
  );
}

// regression: pack-builder-shows-player-progress — the pack builder's
// story staged a player's view of the pack (puzzles completed, a filled
// "Continue" button), so building and playing read as one screen. The
// builder's stage is the pack's puzzles, each with its editing tools.
test("a pack's puzzles are listed in order, each with its tools and no play controls", () => {
  mount(() => (
    <SurfaceStackProvider>
      <ContentPackEditorView
        readable
        count={2}
        order={
          <>
            {row('a', true, false)}
            {row('b', false, true)}
          </>
        }
        candidates={[]}
        addDisabled={false}
        onAdd={() => undefined}
      />
    </SurfaceStackProvider>
  ));
  const order = screen.getByTestId('content-pack-order');
  expect(order.textContent?.startsWith('Puzzles in this packPuzzle a')).toBe(
    true
  );
  const first = screen.getByTestId('content-pack-item-a');
  expect(
    first.querySelector('[data-component="MenuRowAction"]')?.textContent
  ).toContain('Puzzle a');
  const menu = first.querySelector('[data-testid="content-pack-menu"]');
  if (!(menu instanceof HTMLElement)) throw new Error('no row menu');
  fireEvent.click(menu);
  expect(screen.getByTestId('content-pack-up').hasAttribute('disabled')).toBe(
    true
  );
  expect(screen.queryByText(/puzzles completed/)).toBeNull();
  expect(screen.queryByText(/^Continue /)).toBeNull();
});

// regression: pack-builder-row-tools-squeeze-titles — each pack row held
// Edit, move up, move down and remove side by side at its end: on a phone
// they squeezed the title into a narrow column ("Publish it before / the
// pack" on three lines), and wide they sat 700px from the titles across a
// stretched row. Wide the list takes a board's measure with the ways to
// add beside it.
// regression: pack-row-three-controls — then a row still carried three
// controls (a status pill, an "Edit" link and a "…" menu). The whole row
// now opens its puzzle, its status a chip at its end, and the "…" menu,
// the one other control, sits beside the row, never inside its button.
test('a pack row opens on a tap anywhere, its status a chip, the rest in one menu', () => {
  let opened = 0;
  mount(
    () => (
      <SurfaceStackProvider>
        <ContentPackEditorView
          readable
          count={2}
          order={
            <>
              {row('a', true, false)}
              {row('b', false, true, () => {
                opened += 1;
              })}
            </>
          }
          candidates={[]}
          addDisabled={false}
          onAdd={() => undefined}
        />
      </SurfaceStackProvider>
    ),
    PHONE
  );
  const second = screen.getByTestId('content-pack-item-b');
  const buttons = [...second.querySelectorAll('button')];
  expect(buttons.length).toBe(2);
  const [open, menu] = buttons;
  if (open === undefined || menu === undefined) throw new Error('no row');
  expect(open.getAttribute('data-component')).toBe('MenuRowAction');
  expect(open.textContent).toBe('Puzzle bPublished');
  expect(
    open.querySelector('[data-testid="content-chip-status"]')
  ).not.toBeNull();
  expect(open.contains(menu)).toBe(false);
  expect(menu.getAttribute('data-testid')).toBe('content-pack-menu');
  expect(menu).toBe(screen.getByRole('button', { name: 'More for Puzzle b' }));
  fireEvent.click(open);
  expect(opened).toBe(1);
  fireEvent.click(menu);
  expect(opened).toBe(1);
  expect(
    screen.getAllByRole('menuitem').map((item) => item.textContent)
  ).toEqual(['Move up', 'Move down', 'Remove from pack']);
  expect(screen.getByTestId('content-pack-down').hasAttribute('disabled')).toBe(
    true
  );
  // The list is the workbench's canvas: a board's measure beside its tools.
  const order = screen.getByTestId('content-pack-order');
  expect(order.closest('[data-component="ContentPackEditor"]')).not.toBeNull();
  expect(order.parentElement?.className).toContain('canvas');
});

function before(a: Element, b: Element): boolean {
  return (
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

type Place = ContentAuthorScreenViewProps['place'];

const PLACES: readonly Place[] = [
  { screen: 'builder' },
  { screen: 'details' },
  { screen: 'board' },
  { screen: 'preview', puzzleId: null },
  { screen: 'publish' },
  { screen: 'copies' },
];

function builder(
  overrides: Partial<ContentAuthorScreenViewProps> = {}
): JSX.Element {
  return (
    <ContentAuthorScreenView
      status="ready"
      documentId="doc-1"
      draftId="draft-1"
      kind="pack"
      body={{
        title: 'Weekend counts',
        description: 'Three counts that get harder.',
        difficulty: '',
        definition: '',
      }}
      save={{ saving: false, dirty: false, error: null }}
      conflicted={false}
      metadataDisabled={false}
      disabled={false}
      place={{ screen: 'builder' }}
      onOpen={() => undefined}
      standing={{ kind: 'validate', invalid: false }}
      puzzles={3}
      copies={2}
      history={<span data-testid="history" />}
      publication={publication()}
      stage={<span data-testid="editor" />}
      preview={<span data-testid="solver-view" />}
      keptCopies={<span data-testid="copies" />}
      onChangeBody={() => undefined}
      onSaveAgain={() => undefined}
      onReturnToLibrary={() => undefined}
      {...overrides}
    />
  );
}

/** What each place alone holds, by a handle of its own. */
const OWN: Record<Place['screen'], string> = {
  builder: 'content-author-steps',
  details: 'content-title',
  board: 'editor',
  preview: 'solver-view',
  publish: 'content-validate',
  copies: 'copies',
};

// regression: pack-builder-steps-out-of-order — the builder was one wall of
// rows: on a phone the draft copies came before the pack's details and its
// publishing controls, and Validate / Publish sat in a card far from the
// stage. The builder's hub now lists its steps in order (details, the
// puzzles, the preview, checking and publishing, then the copies), each a
// row that says where it stands and opens a screen of its own.
test('the hub lists the steps in order, each with where it stands, and nothing else', () => {
  const opened: Place[] = [];
  mount(() => builder({ onOpen: (place) => opened.push(place) }));
  const steps = screen.getByTestId('content-author-steps');
  const rows = [...steps.querySelectorAll('[data-component="MenuRow"]')];
  expect(rows.map((entry) => entry.getAttribute('data-testid'))).toEqual([
    'content-author-details-toggle',
    'content-open-board',
    'content-preview',
    'content-open-publish',
    'content-open-copies',
  ]);
  expect(rows.map((entry) => entry.textContent)).toEqual([
    'DetailsThree counts that get harder.Weekend counts',
    'PuzzlesAdd, order and remove puzzles3',
    'PreviewThe draft as a solver sees it',
    'Check and publishPlaytest, validate and publishValidate next',
    'Draft copiesEvery save keeps a copy2',
  ]);
  // The hub holds rows and one command: no form, no board, no step's own controls.
  for (const place of PLACES.filter((entry) => entry.screen !== 'builder'))
    expect(screen.queryByTestId(OWN[place.screen])).toBeNull();
  expect(screen.queryByTestId('history')).toBeNull();
  expect(screen.queryByTestId('content-publish')).toBeNull();
  for (const entry of rows) fireEvent.click(entry);
  expect(opened).toEqual(PLACES.filter((entry) => entry.screen !== 'builder'));
});

test('every step is a screen of its own, holding only its own controls', () => {
  for (const place of PLACES) {
    mount(() => builder({ place }));
    expect(screen.getByTestId(OWN[place.screen])).toBeDefined();
    for (const other of PLACES.filter((entry) => entry.screen !== place.screen))
      expect(screen.queryByTestId(OWN[other.screen])).toBeNull();
    const root = screen.getByTestId('content-author');
    expect(root.getAttribute('data-place')).toBe(place.screen);
    expect(root.getAttribute('data-documentid')).toBe('doc-1');
    expect(root.getAttribute('data-draftid')).toBe('draft-1');
    expect(root.getAttribute('data-screen')).toBe(
      place.screen === 'builder'
        ? 'puzzle-content-author'
        : `puzzle-content-author-${place.screen}`
    );
    // No disclosure and no tabs hide part of any builder screen.
    expect(document.querySelector('[aria-expanded]')).toBeNull();
    expect(document.querySelector('[role="tab"]')).toBeNull();
    cleanup();
  }
});

const STANDINGS: readonly [ContentBuilderStanding, string, string, string][] = [
  [
    { kind: 'puzzles', waiting: ['Count to nine'] },
    '1 puzzle to publish first',
    'content-open-waiting',
    'Next: finish Count to nine',
  ],
  [
    { kind: 'fix' },
    'Fix the board first',
    'content-author-next',
    'Next: fix the board',
  ],
  [
    { kind: 'playtest' },
    'Playtest next',
    'content-author-next',
    'Next: playtest',
  ],
  [
    { kind: 'validate', invalid: false },
    'Validate next',
    'content-author-next',
    'Next: validate',
  ],
  [
    { kind: 'validate', invalid: true },
    'Needs changes',
    'content-author-next',
    'Next: validate',
  ],
  [
    { kind: 'publish' },
    'Ready to publish',
    'content-author-next',
    'Next: publish',
  ],
  [
    { kind: 'published', current: true },
    'Published',
    'content-view-publication',
    'View published edition',
  ],
];

test('the hub has exactly one filled command: the next step, leading to where it is taken', () => {
  for (const [standing, value, testid, label] of STANDINGS) {
    const opened: Place[] = [];
    let waiting = 0;
    let viewed = 0;
    mount(() =>
      builder({
        standing,
        onOpen: (place) => opened.push(place),
        onOpenWaiting: () => {
          waiting += 1;
        },
        onViewPublication: () => {
          viewed += 1;
        },
      })
    );
    expect(screen.getByTestId('content-open-publish').textContent).toContain(
      value
    );
    const filled = [
      ...document.querySelectorAll(
        '[data-component="Button"][data-variant="solid"]'
      ),
    ];
    expect(filled.map((button) => button.getAttribute('data-testid'))).toEqual([
      testid,
    ]);
    expect(filled[0]?.textContent).toBe(label);
    fireEvent.click(filled[0] as HTMLElement);
    const expected: Place[] =
      testid !== 'content-author-next'
        ? []
        : [{ screen: standing.kind === 'fix' ? 'board' : 'publish' }];
    expect(opened).toEqual(expected);
    expect(waiting).toBe(testid === 'content-open-waiting' ? 1 : 0);
    expect(viewed).toBe(testid === 'content-view-publication' ? 1 : 0);
    cleanup();
  }
});

test('a copy on its way has nothing to press on the hub: its row says where it stands', () => {
  const waiting: readonly [ContentBuilderStanding, string][] = [
    [{ kind: 'reading' }, 'Checking publication'],
    [{ kind: 'pending', connection: 'online' }, 'Awaiting confirmation'],
    [{ kind: 'pending', connection: 'offline' }, 'Waiting for connection'],
    [{ kind: 'published', current: false }, 'Previously published'],
  ];
  for (const [standing, value] of waiting) {
    mount(() => builder({ standing }));
    expect(screen.getByTestId('content-open-publish').textContent).toContain(
      value
    );
    expect(
      document.querySelector('[data-component="Button"][data-variant="solid"]')
    ).toBeNull();
    cleanup();
  }
});

// regression: builder-editing-tools-apart-from-stage — undo, redo and
// preview sat under the stage beside nothing, and the playtest was a second
// filled button. Undo and redo head the board they act on; the preview and
// publishing are screens of their own, the playtest a step of publishing.
test('undo and redo head the board; publishing is a screen of its own', () => {
  mount(() => builder({ kind: 'puzzle', place: { screen: 'board' } }));
  const stage = screen.getByTestId('content-author-stage');
  const tools = screen.getByTestId('content-author-tools');
  expect(stage.firstElementChild).toBe(tools);
  expect(tools.contains(screen.getByTestId('history'))).toBe(true);
  expect(stage.contains(screen.getByTestId('editor'))).toBe(true);
  expect(before(tools, screen.getByTestId('editor'))).toBe(true);
  expect(screen.getByTestId('content-author-stage-step').textContent).toBe(
    'Board'
  );
  expect(screen.queryByTestId('content-preview')).toBeNull();
  expect(screen.queryByTestId('content-author-publish')).toBeNull();
  cleanup();
  mount(() =>
    builder({
      kind: 'puzzle',
      place: { screen: 'publish' },
      publication: publication({
        kind: 'puzzle',
        before: () => <span data-testid="playtest" />,
      }),
    })
  );
  const publish = screen.getByTestId('content-author-publish');
  expect(publish.contains(screen.getByTestId('playtest'))).toBe(true);
  expect(publish.contains(screen.getByTestId('content-validate'))).toBe(true);
  expect(publish.contains(screen.getByTestId('content-publish'))).toBe(true);
  expect(screen.queryByTestId('editor')).toBeNull();
});

// regression: builder-publish-bar-covers-content — the publish bar was a
// sticky card inside the scroll area, so on both sizes it covered the
// board's last row, the pack's puzzle list and the helper text under it.
// regression: builder-publish-strip-clips-stage — then it was a strip
// pinned under the scroll area, which cut the pack builder's "Create puzzle
// in this pack" in half and hid the phone's Sokoban board. Publishing is
// now a screen of its own, and the board's screen has nothing but the
// board: nothing is pinned over either.
for (const [size, name] of [
  [PHONE, 'a phone'],
  [DESKTOP, 'a desktop'],
] as const)
  test(`on ${name} nothing is pinned over the board or the publish screen`, () => {
    mount(() => builder({ place: { screen: 'board' } }), size);
    const board = document.querySelector(
      '[data-screen="puzzle-content-author-board"]'
    );
    expect(board?.contains(screen.getByTestId('content-author-stage'))).toBe(
      true
    );
    expect(board?.parentElement?.children.length).toBe(1);
    expect(screen.queryByTestId('content-validate')).toBeNull();
    expect(
      document.querySelector('[data-component="EmbeddedScreenFooter"]')
    ).toBeNull();
    cleanup();
    mount(() => builder({ place: { screen: 'publish' } }), size);
    const scroller = document.querySelector(
      '[data-screen="puzzle-content-author-publish"]'
    );
    expect(
      scroller?.contains(screen.getByTestId('content-author-publish'))
    ).toBe(true);
    expect(scroller?.parentElement?.children.length).toBe(1);
    expect(
      document.querySelector('[data-component="EmbeddedScreenFooter"]')
    ).toBeNull();
    expect(document.querySelector('[data-component="StepFooter"]')).toBeNull();
  });

// regression: builder-step-two-left-of-step-one — wide, the details sat in
// the rail beside the stage, so "2 · Board" read left of "1 · Details".
// The details are a form on a screen of their own; only the board and the
// preview are stages.
test('the details are a form of their own; only the board and the preview are stages', () => {
  for (const place of PLACES) {
    mount(() => builder({ place }));
    const stage = place.screen === 'board' || place.screen === 'preview';
    expect(
      document.querySelector('[data-component="GameLayout"]') !== null
    ).toBe(stage);
    cleanup();
  }
  mount(() => builder({ place: { screen: 'details' } }));
  const details = screen.getByTestId('content-author-details');
  expect(details.closest('[data-component="GameLayout"]')).toBeNull();
  expect(details.contains(screen.getByTestId('content-title'))).toBe(true);
  expect(details.contains(screen.getByTestId('content-description'))).toBe(
    true
  );
  expect(details.contains(screen.getByTestId('content-difficulty'))).toBe(true);
});

// regression: builder-details-before-canvas — on a phone the title,
// description and difficulty fields filled the screen before any of the
// board or the pack's puzzles. The details are one row of the hub that
// summarises them, and their fields a screen that row opens.
test('the hub summarises the details in one row that opens their fields', () => {
  const opened: Place[] = [];
  mount(() => builder({ onOpen: (place) => opened.push(place) }), PHONE);
  const row = screen.getByTestId('content-author-details-toggle');
  expect(row.hasAttribute('aria-expanded')).toBe(false);
  expect(row.textContent).toContain('Three counts that get harder.');
  expect(row.textContent).toContain('Weekend counts');
  expect(screen.queryByTestId('content-title')).toBeNull();
  fireEvent.click(row);
  expect(opened).toEqual([{ screen: 'details' }]);
});

test('an untitled draft says so on the hub, and its details row still leads to the fields', () => {
  mount(
    () =>
      builder({
        body: { title: '', description: '', difficulty: '', definition: '' },
      }),
    PHONE
  );
  expect(screen.getByTestId('content-author-title').textContent).toBe(
    'Untitled draft'
  );
  const row = screen.getByTestId('content-author-details-toggle');
  expect(row.textContent).toBe(
    'DetailsTitle, description and difficultyNo title yet'
  );
});

test('the details form changes the draft as it is typed, and Done returns to the steps', () => {
  const bodies: string[] = [];
  const opened: Place[] = [];
  mount(() =>
    builder({
      place: { screen: 'details' },
      onChangeBody: (body) => bodies.push(body.title),
      onOpen: (place) => opened.push(place),
    })
  );
  fireEvent.input(screen.getByLabelText('Title'), {
    target: { value: 'Weekday counts' },
  });
  expect(bodies).toEqual(['Weekday counts']);
  const done = screen.getByTestId('content-details-done');
  expect(done.getAttribute('data-variant')).toBe('solid');
  expect(
    document.querySelectorAll('[data-component="Button"][data-variant="solid"]')
  ).toHaveLength(1);
  fireEvent.click(done);
  expect(opened).toEqual([{ screen: 'builder' }]);
});

// regression: builder-proof-pill-floats — "Not proven yet" was a pill
// floating over the publish buttons. Where the draft stands is the publish
// screen's line of text, beside its actions.
test('the publish screen says where the draft stands in its own text', () => {
  mount(() =>
    builder({
      kind: 'puzzle',
      place: { screen: 'publish' },
      publication: publication({ kind: 'puzzle' }),
    })
  );
  const status = screen.getByTestId('content-publication-status');
  expect(screen.getByTestId('content-author-publish').contains(status)).toBe(
    true
  );
  expect(status.tagName).toBe('P');
  expect(status.textContent).toBe(
    'Next: finish a playtest to show the puzzle can be solved.'
  );
  expect(
    screen.getByTestId('content-proof').closest('[data-component="Badge"]')
  ).toBeNull();
});

const PLACE_NAMES: Record<Place['screen'], string> = {
  builder: 'Pack builder',
  details: 'Details',
  board: 'Puzzles',
  preview: 'Preview',
  publish: 'Check and publish',
  copies: 'Draft copies',
};

// regression: pack-builder-phone-list-buried — on a phone the pack
// builder's title, a save line, the details and a row of three outlined
// pills came before the pack's puzzles, which then sat behind the publish
// strip. The save line is part of the subtitle under the draft's title, on
// every builder screen, and the pack's puzzles follow it directly on theirs.
test('the shell shows on every place: the title, where it is, and the save line', () => {
  for (const place of PLACES) {
    mount(() => builder({ place }), PHONE);
    const save = screen.getByTestId('content-draft-save-status');
    expect(save.getAttribute('role')).toBe('status');
    const intro = save.closest('[data-component="ScreenIntro"]');
    expect(intro?.textContent).toContain(
      `${PLACE_NAMES[place.screen]} · Saved on this device.`
    );
    expect(intro?.contains(screen.getByTestId('content-author-title'))).toBe(
      true
    );
    expect(screen.getByTestId('content-author-title').textContent).toBe(
      'Weekend counts'
    );
    cleanup();
  }
  mount(() => builder({ place: { screen: 'board' } }), PHONE);
  const tools = screen.getByTestId('content-author-tools');
  expect(tools.contains(screen.getByTestId('content-author-stage-step'))).toBe(
    true
  );
  expect(tools.contains(screen.getByTestId('history'))).toBe(true);
});

test('the save line names saving, unsaved and saved', () => {
  const lines = [
    [{ saving: true, dirty: true, error: null }, 'Saving your draft…'],
    [
      { saving: false, dirty: true, error: null },
      'Your changes still need to be saved.',
    ],
    [
      { saving: false, dirty: false, error: null },
      'Saved on this device. Changes share when connected.',
    ],
  ] as const;
  for (const [save, line] of lines) {
    mount(() => builder({ save }));
    expect(screen.getByTestId('content-draft-save-status').textContent).toBe(
      line
    );
    cleanup();
  }
});

test('a failed save, a conflicting copy and a refused publication are said on every place', () => {
  for (const place of PLACES) {
    let retried = 0;
    mount(() =>
      builder({
        place,
        save: { saving: false, dirty: true, error: 'No room left.' },
        conflicted: true,
        refusal: <span data-testid="refusal">Refused</span>,
        confirms: <span data-testid="confirms" />,
        onSaveAgain: () => {
          retried += 1;
        },
      })
    );
    const root = screen.getByTestId('content-author');
    expect(screen.getByText('Your changes are still here')).toBeDefined();
    expect(screen.getByText('No room left.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save again' }));
    expect(retried).toBe(1);
    expect(screen.getByTestId('content-author-conflict').textContent).toContain(
      'Another device saved a different copy of this draft.'
    );
    expect(root.contains(screen.getByTestId('refusal'))).toBe(true);
    // The notices come before the place's own content.
    expect(
      before(
        screen.getByTestId('refusal'),
        screen.getByTestId(OWN[place.screen])
      )
    ).toBe(true);
    // The confirmation dialogs belong to the shell, outside the place.
    expect(root.contains(screen.getByTestId('confirms'))).toBe(false);
    cleanup();
  }
});

test('the preview is disabled on the hub while there is nothing to preview or the builder is busy', () => {
  const disabled = () =>
    (screen.getByTestId('content-preview') as HTMLButtonElement).disabled;
  mount(() => builder({ previewable: false }));
  expect(disabled()).toBe(true);
  expect(screen.getByTestId('content-preview').textContent).toContain(
    'Nothing to preview yet'
  );
  cleanup();
  mount(() => builder({ disabled: true }));
  expect(disabled()).toBe(true);
  cleanup();
  mount(() => builder());
  expect(disabled()).toBe(false);
});

test('a puzzle whose board cannot be played says so on its row', () => {
  mount(() => builder({ kind: 'puzzle', playable: false }));
  expect(screen.getByTestId('content-open-board').textContent).toBe(
    'BoardBuild the puzzleCannot be played yet'
  );
  expect(
    screen
      .getByTestId('content-draft-save-status')
      .closest('[data-component="ScreenIntro"]')?.textContent
  ).toContain('Puzzle builder · ');
});

test('loading, denied, gone and missing are states of their own, each with a way on', () => {
  mount(() => builder({ status: 'loading' }));
  expect(document.querySelector('[data-component="LoadingState"]')).not.toBe(
    null
  );
  expect(screen.queryByTestId('content-author')).toBeNull();
  cleanup();
  let returned = 0;
  for (const [status, title] of [
    ['gone', 'This draft is no longer here'],
    ['missing', 'This draft is not available on this device'],
  ] as const) {
    mount(() =>
      builder({
        status,
        onReturnToLibrary: () => {
          returned += 1;
        },
      })
    );
    expect(screen.getByText(title)).toBeDefined();
    expect(screen.queryByTestId('content-author')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Return to puzzles' }));
    cleanup();
  }
  expect(returned).toBe(2);
});

// regression: builder-playtest-remounts — the playtest step was rebuilt
// each time the draft's check changed, so a started playtest lost its
// "Open playtest" and the Sokoban journey could not open it. The playtest
// is drawn where it stands (filled over the steps while it is next, then
// in its done step), so it is drawn again only when that place changes,
// never as the check changes; the playtest it started is the builder's to
// keep (`ContentDraftPlaytest`'s `attemptId`), whichever screen is shown.
test('in the steps, the playtest is drawn again only when its place changes', () => {
  const [validation, setValidation] = createSignal<
    'unchecked' | 'valid' | 'invalid' | null
  >('unchecked');
  const [proven, setProven] = createSignal(false);
  const seen: boolean[] = [];
  mount(() => (
    <ContentPublicationControlsView
      copyState={{ kind: 'draft' }}
      kind="puzzle"
      validation={validation()}
      validationMessage=""
      proven={proven()}
      pending={null}
      published={false}
      disabled={false}
      onValidate={resolved}
      onPublish={resolved}
      onViewPublication={() => undefined}
      onWithdraw={() => undefined}
      before={(isNext) => {
        seen.push(isNext());
        return <span data-testid="playtest" />;
      }}
    />
  ));
  setValidation(null);
  setValidation('invalid');
  setValidation('unchecked');
  expect(seen).toEqual([true]);
  setProven(true);
  setValidation('valid');
  expect(seen).toEqual([true, false]);
  expect(screen.getAllByTestId('playtest').length).toBe(1);
});
