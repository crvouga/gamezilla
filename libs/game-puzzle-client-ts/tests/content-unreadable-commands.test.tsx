/** @jsxImportSource solid-js */
/** Commands that cannot help with unreadable content are not offered. */

import { afterEach, expect, test } from 'bun:test';
import { ContentAttemptControls } from '@libs/game-puzzle-client-ts/content-attempt-controls';
import { ContentDraftPlaytest } from '@libs/game-puzzle-client-ts/content-draft-playtest';
import {
  type ContentGame,
  ContentGameProvider,
} from '@libs/game-puzzle-client-ts/content-game-context';
import {
  ContentLibraryProvider,
  type ContentLibraryState,
} from '@libs/game-puzzle-client-ts/content-library-context';
import type { ContentAttempt } from '@libs/game-puzzle-shared-ts/attempt-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { MutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import { MutationClientContext } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

function game(readable?: (definition: string) => boolean): ContentGame {
  return {
    id: 'puzzle-game',
    title: 'Puzzle game',
    content: { history: 'snapshots' },
    client: {
      authoring: {
        initialDefinition: () => '{}',
        Editor: () => null,
        readable,
      },
    },
    catalog: {},
    open: () => undefined,
  } as unknown as ContentGame;
}

function mount(value: ContentGame, ui: () => JSX.Element): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <MutationClientContext.Provider value={{} as MutationClient}>
          <IdProvider createId={() => 'id'} random={() => 0.5}>
            <ContentGameProvider value={value}>
              <ContentLibraryProvider value={{} as ContentLibraryState}>
                {ui()}
              </ContentLibraryProvider>
            </ContentGameProvider>
          </IdProvider>
        </MutationClientContext.Provider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

function disabled(testId: string): boolean {
  const button = screen.getByTestId(testId);
  return (
    button.hasAttribute('disabled') ||
    button.getAttribute('aria-disabled') === 'true'
  );
}

const attempt = {
  id: 'attempt-1',
  pack_revision_id: null,
  mode: 'solve',
} as unknown as ContentAttempt;
const writer = {
  pending: () => false,
  execute: () => undefined,
} as unknown as Parameters<typeof ContentAttemptControls>[0]['writer'];

// regression: puzzle-unreadable-content-keeps-commands
// A puzzle whose content cannot be read kept Undo, Redo and Restart usable,
// though restarting reopens the same unreadable puzzle. A merely unreadable
// saved position still offers Restart, its documented recovery.
test('unreadable puzzle content disables Undo, Redo and Restart', () => {
  mount(game(), () => (
    <ContentAttemptControls
      attempt={attempt}
      writer={writer}
      progress={{ complete: false, canUndo: true, canRedo: true }}
      unreadable
    />
  ));
  expect(disabled('content-undo')).toBe(true);
  expect(disabled('content-redo')).toBe(true);
  expect(disabled('content-restart')).toBe(true);
});

test('readable content with an unopenable position keeps Restart', () => {
  mount(game(), () => (
    <ContentAttemptControls
      attempt={attempt}
      writer={writer}
      progress={null}
      unreadable={false}
    />
  ));
  expect(disabled('content-undo')).toBe(true);
  expect(disabled('content-restart')).toBe(false);
});

function draftWriter(definition: string) {
  return {
    body: () => ({
      title: 'Draft',
      description: '',
      difficulty: '',
      definition,
    }),
    save: async () => undefined,
    dirty: () => false,
    draftId: () => 'draft-1',
  } as unknown as Parameters<typeof ContentDraftPlaytest>[0]['writer'];
}

test('a draft its editor cannot read cannot be playtested', () => {
  mount(
    game((definition) => definition !== 'unreadable'),
    () => (
      <ContentDraftPlaytest
        documentId="document-1"
        writer={draftWriter('unreadable')}
        next
        disabled={false}
      />
    )
  );
  expect(disabled('content-start-playtest')).toBe(true);
});

test('a game without a readability check keeps playtesting available', () => {
  mount(game(), () => (
    <ContentDraftPlaytest
      documentId="document-1"
      writer={draftWriter('unreadable')}
      next
      disabled={false}
    />
  ));
  expect(disabled('content-start-playtest')).toBe(false);
});
