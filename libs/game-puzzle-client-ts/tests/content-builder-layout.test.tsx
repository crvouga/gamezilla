/** @jsxImportSource solid-js */
/** The puzzle and pack builders: one next step, editing tools by the stage, plain words. */

import { afterEach, expect, test } from 'bun:test';
import { ContentAuthorScreenView } from '@libs/game-puzzle-client-ts/content-author-screen-view';
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
import { createEffect, createSignal, type JSX } from 'solid-js';

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
      onWithdraw={resolved}
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
// one tier of action came in three weights. The next step is filled and
// every other step is an outline.
test('until the draft passes its check, Validate is the one filled step', () => {
  mount(() => publication());
  expect(variants()).toEqual({ validate: 'solid', publish: 'outline' });
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
  expect(variants()).toEqual({ validate: 'outline', publish: 'outline' });
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
  expect(variants()).toEqual({ validate: 'solid', publish: 'outline' });
});

function row(id: string, first: boolean, last: boolean): JSX.Element {
  return (
    <ContentPackItemRow
      id={id}
      title={`Puzzle ${id}`}
      caption="Published"
      first={first}
      last={last}
      disabled={false}
      open="edit"
      onOpen={() => undefined}
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
    first.querySelector('[data-testid="content-pack-open"]')?.textContent
  ).toBe('Edit');
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
// stretched row. A row now holds Edit and one "…" menu with the rest, and
// wide the list takes a board's measure with the ways to add beside it.
test("a pack row keeps its title's room: Edit and one menu, the list a board's measure", () => {
  mount(
    () => (
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
    ),
    PHONE
  );
  const second = screen.getByTestId('content-pack-item-b');
  const controls = Array.from(
    second.querySelectorAll('button'),
    (button) => button.getAttribute('data-testid') ?? button.textContent
  ).filter((id) => id !== 'content-pack-item-b');
  expect(controls).toEqual(['content-pack-open', 'content-pack-menu']);
  expect(
    second.querySelector('[data-testid="content-pack-menu"]') ===
      screen.getByRole('button', { name: 'More for Puzzle b' })
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'More for Puzzle b' }));
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

// regression: builder-editing-tools-apart-from-stage — undo, redo and
// preview sat under the stage beside nothing, and the playtest was a second
// filled button. The tools now head the stage; the playtest is an outline
// step inside Publish.
test('the editing tools head the stage, and publishing has a section of its own', () => {
  mount(() => (
    <ContentAuthorScreenView
      status="ready"
      documentId="doc-1"
      kind="puzzle"
      body={{
        title: 'Two crates',
        description: '',
        difficulty: '',
        definition: '',
      }}
      save={{ saving: false, dirty: false, error: null }}
      conflicted={false}
      metadataDisabled={false}
      disabled={false}
      preview={false}
      history={<span data-testid="history" />}
      publication={publication({
        kind: 'puzzle',
        layout: 'bar',
        before: () => <span data-testid="playtest" />,
      })}
      stage={<span data-testid="editor" />}
      onChangeBody={() => undefined}
      onSaveAgain={() => undefined}
      onTogglePreview={() => undefined}
      onReturnToLibrary={() => undefined}
    />
  ));
  const stage = screen.getByTestId('content-author-stage');
  const tools = screen.getByTestId('content-author-tools');
  expect(stage.firstElementChild).toBe(tools);
  expect(tools.contains(screen.getByTestId('content-preview'))).toBe(true);
  expect(stage.contains(screen.getByTestId('editor'))).toBe(true);
  const publish = screen.getByTestId('content-author-publish');
  expect(publish.contains(screen.getByTestId('playtest'))).toBe(true);
  expect(publish.contains(screen.getByTestId('content-validate'))).toBe(true);
});

function before(a: Element, b: Element): boolean {
  return (
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

function builder(
  overrides: Partial<Parameters<typeof ContentAuthorScreenView>[0]> = {}
): JSX.Element {
  return (
    <ContentAuthorScreenView
      status="ready"
      documentId="doc-1"
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
      preview={false}
      history={<span data-testid="history" />}
      publication={publication({ layout: 'bar' })}
      stage={<span data-testid="editor" />}
      keptCopies={<span data-testid="copies" />}
      onChangeBody={() => undefined}
      onSaveAgain={() => undefined}
      onTogglePreview={() => undefined}
      onReturnToLibrary={() => undefined}
      {...overrides}
    />
  );
}

// regression: pack-builder-steps-out-of-order — the builder was one wall of
// rows: on a phone the draft copies came before the pack's details and its
// publishing controls, and Validate / Publish sat in a card far from the
// stage. The builder now reads as numbered steps (details, then the stage
// headed by its tools, then checking and publishing), and the copies,
// which are no step, come after them.
test('the builder reads as steps, with the draft copies after them', () => {
  mount(() => builder());
  const details = screen.getByTestId('content-author-details');
  const stage = screen.getByTestId('content-author-stage');
  const copies = screen.getByTestId('copies');
  const publish = screen.getByTestId('content-author-publish');
  expect(before(details, stage)).toBe(true);
  expect(before(stage, publish)).toBe(true);
  expect(before(publish, copies)).toBe(true);
  expect(details.textContent?.startsWith('1 · Details')).toBe(true);
  expect(screen.getByTestId('content-author-stage-step').textContent).toBe(
    '2 · Puzzles'
  );
  expect(publish.getAttribute('data-component')).toBe('StepFooter');
  expect(publish.textContent?.startsWith('3 · Check and publish')).toBe(true);
  expect(publish.contains(screen.getByTestId('content-validate'))).toBe(true);
  expect(publish.contains(screen.getByTestId('content-publish'))).toBe(true);
  expect(
    screen
      .getByTestId('content-author-tools')
      .contains(screen.getByTestId('history'))
  ).toBe(true);
});

// regression: builder-publish-bar-covers-content — the publish bar was a
// sticky card inside the scroll area, so on both sizes it covered the
// board's last row, the pack's puzzle list and the helper text under it.
// regression: builder-publish-strip-clips-stage — then it was a strip
// pinned under the scroll area, which cut the pack builder's "Create puzzle
// in this pack" in half and hid the phone's Sokoban board. It is now a
// section in the scroll content's flow, right after the stage, and nothing
// is pinned at the screen's foot.
for (const [size, name] of [
  [PHONE, 'a phone'],
  [DESKTOP, 'a desktop'],
] as const)
  test(`on ${name} the publish step is a section in the scroll content, never pinned over it`, () => {
    mount(() => builder(), size);
    const publish = screen.getByTestId('content-author-publish');
    // The screen's own scroll area carries its screen id.
    const scroller = document.querySelector(
      '[data-screen="puzzle-content-author"]'
    );
    expect(scroller).not.toBeNull();
    expect(scroller?.contains(publish)).toBe(true);
    // It is one section in the stage's column, right after the stage.
    const stage = screen.getByTestId('content-author-stage');
    expect(publish.parentElement).toBe(stage.parentElement);
    expect(stage.nextElementSibling).toBe(publish);
    // No strip outside the scroll area holds a screen footer.
    expect(scroller?.parentElement?.children.length).toBe(1);
    expect(
      document.querySelector('[data-component="EmbeddedScreenFooter"]')
    ).toBeNull();
  });

// regression: builder-step-two-left-of-step-one — wide, the details sat in
// the rail beside the stage, so "2 · Board" read left of "1 · Details".
// The details now head the builder, above the stage and its rail.
test('wide, the details head the builder instead of sitting beside the stage', () => {
  mount(() => builder());
  const details = screen.getByTestId('content-author-details');
  expect(details.closest('[data-component="GameLayout"]')).toBeNull();
  const layout = screen
    .getByTestId('content-author-stage')
    .closest('[data-component="GameLayout"]');
  expect(layout).not.toBeNull();
  expect(before(details, layout as Element)).toBe(true);
});

// regression: builder-details-before-canvas — on a phone the title,
// description and difficulty fields filled the screen before any of the
// board or the pack's puzzles. A titled draft's details are one closed
// row, summarised, over the stage; a new draft opens on them.
test("a titled draft's details are one closed row that opens on its fields", () => {
  mount(() => builder(), PHONE);
  const toggle = screen.getByTestId('content-author-details-toggle');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(toggle.textContent).toContain('Three counts that get harder.');
  expect(screen.queryByTestId('content-title')).toBeNull();
  toggle.click();
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByTestId('content-title')).toBeDefined();
});

test('an untitled draft opens on its details', () => {
  mount(
    () =>
      builder({
        body: { title: '', description: '', difficulty: '', definition: '' },
      }),
    PHONE
  );
  expect(
    screen
      .getByTestId('content-author-details-toggle')
      .getAttribute('aria-expanded')
  ).toBe('true');
  expect(screen.getByTestId('content-title')).toBeDefined();
});

// regression: builder-proof-pill-floats — "Not proven yet" was a pill
// floating over the publish buttons. Where the draft stands is now the
// publish footer's line of text, beside its actions.
test('the publish footer says where the draft stands in its own text', () => {
  mount(() =>
    builder({
      kind: 'puzzle',
      publication: publication({ kind: 'puzzle', layout: 'bar' }),
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

// regression: pack-builder-phone-list-buried — on a phone the pack
// builder's title, a save line, the details and a row of three outlined
// pills came before the pack's puzzles, which then sat behind the publish
// strip. The save line is now part of the title's subtitle, and undo,
// redo and preview are small ghost tools on the step's own row, so the
// pack's puzzles and their actions follow the details directly.
test('on a phone the save line joins the subtitle and the stage tools share the step row', () => {
  mount(() => builder(), PHONE);
  const save = screen.getByTestId('content-draft-save-status');
  expect(save.getAttribute('role')).toBe('status');
  expect(save.closest('[data-component="ScreenIntro"]')).not.toBeNull();
  expect(save.closest('[data-component="ScreenIntro"]')?.textContent).toContain(
    'Pack builder · Saved on this device.'
  );
  const tools = screen.getByTestId('content-author-tools');
  const preview = screen.getByTestId('content-preview');
  expect(tools.contains(screen.getByTestId('content-author-stage-step'))).toBe(
    true
  );
  expect(preview.getAttribute('data-variant')).toBe('ghost');
  expect(preview.getAttribute('data-size')).toBe('sm');
  expect(preview.textContent).toBe('Preview');
});

// regression: builder-playtest-remounts — the playtest step was rebuilt
// each time the draft's check changed, so a started playtest lost its
// "Open playtest" and the Sokoban journey could not open it. The step is
// mounted once and only told whether it is the next one.
test('the playtest step stays mounted as the check changes, told when it is next', () => {
  const [validation, setValidation] = createSignal<
    'unchecked' | 'valid' | 'invalid' | null
  >('unchecked');
  const [proven, setProven] = createSignal(false);
  let mounts = 0;
  const seen: boolean[] = [];
  mount(() => (
    <ContentPublicationControlsView
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
      onWithdraw={resolved}
      before={(isNext) => {
        mounts += 1;
        createEffect(() => seen.push(isNext()));
        return <span data-testid="playtest" />;
      }}
    />
  ));
  setValidation(null);
  setValidation('unchecked');
  setProven(true);
  setValidation('valid');
  expect(mounts).toBe(1);
  expect(seen).toEqual([true, false]);
});
