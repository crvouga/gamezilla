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
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

function mount(ui: () => JSX.Element): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 1440, height: 900 }}
      >
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
test('until the draft passes its check, Validate is the one filled step', () => {
  mount(() => publication());
  expect(variants()).toEqual({ validate: 'solid', publish: 'outline' });
});

test('once the draft passes its check, Publish is the one filled step', () => {
  mount(() => publication({ validation: 'valid' }));
  expect(variants()).toEqual({ validate: 'outline', publish: 'solid' });
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
  ));
  const order = screen.getByTestId('content-pack-order');
  expect(order.textContent?.startsWith('Puzzles in this packPuzzle a')).toBe(
    true
  );
  const first = screen.getByTestId('content-pack-item-a');
  expect(
    first.querySelector('[data-testid="content-pack-open"]')?.textContent
  ).toBe('Edit');
  expect(
    first
      .querySelector('[data-testid="content-pack-up"]')
      ?.hasAttribute('disabled')
  ).toBe(true);
  expect(screen.queryByText(/puzzles completed/)).toBeNull();
  expect(screen.queryByText(/^Continue /)).toBeNull();
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
      playtest={<span data-testid="playtest" />}
      publication={publication({ kind: 'puzzle' })}
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

// regression: pack-builder-steps-out-of-order — the builder was one wall of
// rows: on a phone the draft copies came before the pack's details and its
// publishing controls, and Validate / Publish sat in a card far from the
// stage. The builder now reads as numbered steps (details, then the stage
// headed by its tools, then the copies), and checking and publishing is a
// bar held at the foot of the screen.
test('the builder reads as steps, with publishing in a sticky bar at its foot', () => {
  mount(() => (
    <ContentAuthorScreenView
      status="ready"
      documentId="doc-1"
      kind="pack"
      body={{
        title: 'Weekend counts',
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
      publication={publication({ layout: 'bar' })}
      stage={<span data-testid="editor" />}
      keptCopies={<span data-testid="copies" />}
      onChangeBody={() => undefined}
      onSaveAgain={() => undefined}
      onTogglePreview={() => undefined}
      onReturnToLibrary={() => undefined}
    />
  ));
  const details = screen.getByTestId('content-author-details');
  const stage = screen.getByTestId('content-author-stage');
  const copies = screen.getByTestId('copies');
  const publish = screen.getByTestId('content-author-publish');
  expect(before(details, stage)).toBe(true);
  expect(before(stage, copies)).toBe(true);
  expect(before(copies, publish)).toBe(true);
  expect(details.textContent?.startsWith('1 · Details')).toBe(true);
  expect(screen.getByTestId('content-author-stage-step').textContent).toBe(
    '2 · Puzzles'
  );
  expect(publish.getAttribute('data-component')).toBe('StickyActionBar');
  expect(publish.textContent?.startsWith('3 · Check and publish')).toBe(true);
  expect(publish.contains(screen.getByTestId('content-validate'))).toBe(true);
  expect(publish.contains(screen.getByTestId('content-publish'))).toBe(true);
  expect(
    screen
      .getByTestId('content-author-tools')
      .contains(screen.getByTestId('history'))
  ).toBe(true);
});
