/** @jsxImportSource solid-js */
/** Publishing reads as one sequence of steps with one next action. */

import { afterEach, expect, test } from 'bun:test';
import { ContentAuthorScreenView } from '@libs/game-puzzle-client-ts/content-author-screen-view';
import {
  ContentPublicationControlsView,
  type ContentPublicationControlsViewProps,
} from '@libs/game-puzzle-client-ts/content-publication-controls-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

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
      layout="bar"
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
      onWithdraw={resolved}
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
// that waits is now locked: muted, behind a lock, saying what it waits
// on, and still pressable, so pressing Publish says what is missing.
test('steps that wait are locked, say what they wait on, and still press', async () => {
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
  for (const [index, id, note] of [
    [1, 'content-validate', 'After the playtest'],
    [2, 'content-publish', 'After validation'],
  ] as const) {
    const button = screen.getByTestId(id);
    expect(button.getAttribute('data-face')).toBe('locked');
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.querySelector('svg')).not.toBeNull();
    expect(steps[index]?.textContent).toContain(note);
  }
  fireEvent.click(screen.getByTestId('content-publish'));
  await Promise.resolve();
  expect(published).toBe(1);
});

// regression: pack-builder-blocker-unnamed — a pack with a puzzle still a
// draft said "Not checked yet. Validate, then publish." with Validate
// filled, though the pack could not publish until that puzzle was. Its
// first step is now publishing its puzzles, named in the next-step line,
// and its lead opens that puzzle; the pack's own steps are locked.
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
  expect(screen.getByTestId('content-pack-puzzles-step').textContent).toContain(
    'Publish its puzzles'
  );
  expect(screen.getByTestId('content-publication-status').textContent).toBe(
    'Next: publish Count to nine first. A pack holds only published puzzles.'
  );
  expect(lead()).toBe(screen.getByTestId('content-open-waiting'));
  expect(lead().textContent).toBe('Open Count to nine to publish it');
  fireEvent.click(lead());
  expect(opened).toBe(1);
  for (const id of ['content-validate', 'content-publish'])
    expect(screen.getByTestId(id).getAttribute('data-face')).toBe('locked');
  const steps = [
    ...screen.getByTestId('content-publication-steps').querySelectorAll('li'),
  ];
  expect(steps[1]?.textContent).toContain('After its puzzles');
  expect(steps[2]?.textContent).toContain('After validation');
});

function builder(): JSX.Element {
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
      preview={false}
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
      onTogglePreview={() => undefined}
      onReturnToLibrary={() => undefined}
    />
  );
}

const follows = (a: Element, b: Element): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

// regression: builder-phone-next-step-below-fold — on a phone the
// builder's playtest and publishing started below the board, the tools and
// the board's size, outside the first screen, with nothing near the top
// saying they were there.
// regression: builder-phone-next-action-quiet — then a quiet link near
// the top only named the next step and scrolled to it. On a phone the
// publish step is now a card right after the details, before the stage,
// its next action filled; it sits in the flow, so it covers nothing.
test('on a phone the next action is a filled button in a card right after the details', () => {
  mount(() => builder(), PHONE);
  const publish = screen.getByTestId('content-author-publish');
  expect(publish.getAttribute('data-component')).toBe('GameSection');
  expect(follows(screen.getByTestId('content-author-details'), publish)).toBe(
    true
  );
  expect(follows(publish, screen.getByTestId('content-author-stage'))).toBe(
    true
  );
  const playtest = screen.getByTestId('playtest');
  expect(publish.contains(playtest)).toBe(true);
  expect(playtest.getAttribute('data-variant')).toBe('solid');
});

test('wide, publishing is the last step, after the stage', () => {
  mount(() => builder(), DESKTOP);
  const publish = screen.getByTestId('content-author-publish');
  expect(publish.getAttribute('data-component')).toBe('StepFooter');
  expect(follows(screen.getByTestId('content-author-stage'), publish)).toBe(
    true
  );
});
