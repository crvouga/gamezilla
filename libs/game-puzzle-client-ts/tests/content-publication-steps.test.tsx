/** @jsxImportSource solid-js */
/** Publishing reads as one sequence of steps with one next action. */

import { afterEach, expect, test } from 'bun:test';
import { ContentAuthorScreenView } from '@libs/game-puzzle-client-ts/content-author-screen-view';
import {
  ContentPublicationControlsView,
  type ContentPublicationControlsViewProps,
} from '@libs/game-puzzle-client-ts/content-publication-controls-view';
import type { PublicationStep } from '@libs/game-puzzle-client-ts/content-publication-steps';
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
      before={() => <span data-testid="playtest" />}
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
  expect(steps[1]?.contains(screen.getByTestId('content-validate'))).toBe(true);
  expect(steps[2]?.contains(screen.getByTestId('content-publish'))).toBe(true);
  expect(steps[1]?.getAttribute('aria-current')).toBe('step');
  expect(screen.getByTestId('content-publication-status').textContent).toBe(
    'Next: validate the draft, then publish it.'
  );
});

test('a checked, proven puzzle has Publish as its one next step', () => {
  mount(() => publication({ proven: true, validation: 'valid' }));
  expect(states()).toEqual(['done', 'done', 'current']);
  expect(screen.getByTestId('content-validation-passed')).toBeDefined();
  expect(
    screen.getByTestId('content-publish').getAttribute('data-variant')
  ).toBe('solid');
});

// regression: pack-builder-blocker-unnamed — a pack with a puzzle still a
// draft said "Not checked yet. Validate, then publish." with Validate
// filled, though the pack could not publish until that puzzle was. Its
// first step is now publishing its puzzles, named in the next-step line,
// and no pack action is filled until they are published.
test('a pack waits on its draft puzzles first, and names them', () => {
  mount(() =>
    publication({
      kind: 'pack',
      before: undefined,
      waitingOn: ['Count to nine'],
    })
  );
  expect(states()).toEqual(['current', 'upcoming', 'upcoming']);
  expect(screen.getByTestId('content-pack-puzzles-step').textContent).toContain(
    'Publish its puzzles'
  );
  expect(screen.getByTestId('content-publication-status').textContent).toBe(
    'Next: publish Count to nine first. A pack holds only published puzzles.'
  );
  for (const id of ['content-validate', 'content-publish'])
    expect(screen.getByTestId(id).getAttribute('data-variant')).toBe('outline');
});

function builder(nextStep: PublicationStep): JSX.Element {
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
      nextStep={nextStep}
      publication={publication()}
      stage={<span data-testid="editor" />}
      onChangeBody={() => undefined}
      onSaveAgain={() => undefined}
      onTogglePreview={() => undefined}
      onReturnToLibrary={() => undefined}
    />
  );
}

// regression: builder-phone-next-step-below-fold — on a phone the
// builder's playtest and publishing started below the board, the tools and
// the board's size, outside the first screen, with nothing near the top
// saying they were there. A quiet button after the details now names the
// next step and takes the person to the publish step; it sits in the flow,
// so it covers nothing, and wide screens go without it.
test('on a phone a quiet button near the top names the next step and goes there', () => {
  const revealed: Element[] = [];
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function reveal(this: HTMLElement) {
    revealed.push(this);
  };
  try {
    mount(() => builder('playtest'), PHONE);
    const jump = screen.getByTestId('content-author-next-step');
    expect(jump.textContent).toBe('Next: start a playtest');
    expect(jump.getAttribute('data-variant')).toBe('ghost');
    const details = screen.getByTestId('content-author-details');
    const stage = screen.getByTestId('content-author-stage');
    const follows = (a: Element, b: Element): boolean =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(details, jump)).toBe(true);
    expect(follows(jump, stage)).toBe(true);
    fireEvent.click(jump);
    expect(revealed).toEqual([screen.getByTestId('content-author-publish')]);
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});

test('wide, where the publish step is in view, there is no jump to it', () => {
  mount(() => builder('playtest'), DESKTOP);
  expect(screen.queryByTestId('content-author-next-step')).toBeNull();
});
