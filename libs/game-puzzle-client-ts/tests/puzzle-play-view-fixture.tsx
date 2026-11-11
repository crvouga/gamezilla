/** @jsxImportSource solid-js */
/** A puzzle play view mounted for layout tests: time stands still. */

import type { PuzzlePlayPlace } from '@libs/game-puzzle-client-ts/puzzle-play-places';
import type {
  PuzzleFeedSettingsModel,
  PuzzlePlayScreenViewProps,
} from '@libs/game-puzzle-client-ts/puzzle-play-screen-model';
import { PuzzlePlayScreenView } from '@libs/game-puzzle-client-ts/puzzle-play-screen-view';
import { DEFAULT_PUZZLE_FEED_CONFIG } from '@libs/game-puzzle-shared-ts/feed-config';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

export const none = (): void => undefined;

/** What the view was asked to do, in order. */
export type ViewCalls = string[];

export const FEED: PuzzleFeedSettingsModel = {
  status: 'ready',
  saved: DEFAULT_PUZZLE_FEED_CONFIG,
  savedReady: true,
  savedTarget: 1500,
  draft: DEFAULT_PUZZLE_FEED_CONFIG,
  draftTarget: 1500,
  profileRating: 1500,
  matched: 12,
  total: 40,
  themes: {
    choices: ['mate', 'fork', 'pin'],
    label: (theme) => theme.toUpperCase(),
  },
  onChange: none,
  onDone: none,
};

const PLIES = [
  { plyIndex: 0, solveIdxAfter: 1, label: 'g6', before: 'b' },
  { plyIndex: 1, solveIdxAfter: 2, label: 'Nxe5', before: 'w' },
];

export const VIEW: PuzzlePlayScreenViewProps = {
  stage: 'playing',
  place: { screen: 'play' },
  onOpen: none,
  onBack: none,
  // A width-driven board draws without a measured room to fit.
  boardSizing: 'width',
  statusKind: 'started',
  solverSide: 'White',
  coach: { message: 'Something on the board is undefended.' },
  elapsedMs: 12_000,
  spectator: false,
  allowanceLabel: '',
  ratingChange: null,
  line: {
    plies: PLIES,
    selectedSolveIdx: 2,
    interactive: true,
    awaiting: true,
    writing: {
      notation: () => 'san',
      format: (label) => label,
      moveNumber: () => null,
    },
    nav: { canGoBack: true, canGoForward: false, onNavigate: none },
    onSeek: none,
  },
  status: 'solving',
  hintStage: 'none',
  canGoForward: false,
  onHint: none,
  onSolution: none,
  onRetry: none,
  onSkip: none,
  onNext: none,
  onIncludeAllPuzzles: none,
  feed: FEED,
  result: {
    completion: null,
    displayRating: 0,
    provisional: false,
    puzzleRating: 1702,
    themes: ['mate'],
  },
  share: { state: 'idle', onShare: none },
  board: () => <p data-testid="board">board</p>,
};

/** A finished, solved puzzle with its rated outcome. */
export const SOLVED: Partial<PuzzlePlayScreenViewProps> = {
  stage: 'finished',
  place: { screen: 'result' },
  statusKind: 'solved',
  status: 'solved',
  ratingChange: 16,
  result: {
    completion: {
      outcome: 'solved',
      ratingBefore: 1500,
      ratingAfter: 1516,
      delta: 16,
      streak: 3,
      puzzleRating: 1702,
      rated: true,
    },
    displayRating: 1516,
    provisional: false,
    puzzleRating: 1702,
    themes: ['mate'],
  },
};

/** Time stands still: the layout is all these tests read. */
const STILL = {
  clock: { now: () => 0 },
  timers: {
    setTimeout: () => 0,
    clearTimeout: none,
    setInterval: () => 0,
    clearInterval: none,
  },
};

/** Mount the view at `width` px on `place`, with `overrides`. */
export function mountPlay(
  place: PuzzlePlayPlace['screen'],
  overrides: Partial<PuzzlePlayScreenViewProps> = {},
  width = 390
): void {
  renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
        <PuzzlePlayScreenView
          {...VIEW}
          {...overrides}
          place={{ screen: place }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
}

/** Every `data-testid` on the page, sorted. */
export function shownIds(): readonly string[] {
  return [...document.querySelectorAll('[data-testid]')]
    .map((node) => node.getAttribute('data-testid') ?? '')
    .sort();
}

/** The filled (primary, solid) buttons on the page, by their words. */
export function filledCommands(): readonly string[] {
  return [
    ...document.querySelectorAll(
      '[data-component="Button"][data-variant="solid"]'
    ),
  ].map((button) => button.textContent ?? '');
}

export function region(name: string): Element {
  const found = document.querySelector(`[data-component="${name}"]`);
  if (found === null) throw new Error(`No ${name}`);
  return found;
}
