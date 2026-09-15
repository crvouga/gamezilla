import { DefineBackButton } from '@libs/spaces/public/nav/spaces-nav-context';
import { SpaceSideRailExtras } from '@libs/spaces/public/space-event-log-placement';
import {
  ISLAND_GAP_STEP,
  ISLAND_SIDE_RAIL_WIDTH,
  Island,
  spacingScale,
  useThemeLayout,
} from '@pkgs/ui';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Match,
  Show,
  Switch,
} from 'solid-js';

import type { HintStage } from '../../shared/puzzle-session/hint-stage';
import { ChessPuzzleActionBar } from './chess-puzzle-action-bar';
import { ChessPuzzleBoardFrame } from './chess-puzzle-board-frame';
import { ChessPuzzleCelebrationOverlay } from './chess-puzzle-celebration-overlay';
import { ChessPuzzleFeedBar } from './chess-puzzle-feed-bar';
import { ChessPuzzleFeedSettingsModal } from './chess-puzzle-feed-settings-modal';
import { ChessPuzzleMoveHistoryBar } from './chess-puzzle-move-history-bar';
import type { PuzzleCompletion } from './use-chess-puzzle-completion';
import type { SolveStatus } from './use-chess-puzzle-solver';

const noopElo = (): void => {};
/** Tight inset so the square board can fill its well. */
const BOARD_WELL_PADDING_PX = spacingScale(2);
const SHELL_GAP_PX = ISLAND_GAP_STEP * 4;

type PlayChromeProps = {
  layout: PuzzlePlayLayoutProps;
  openFeedSettings: () => void;
};

function completionKey(completion: PuzzleCompletion): string {
  return [
    completion.outcome,
    completion.ratingBefore,
    completion.ratingAfter,
    completion.puzzleRating,
    completion.streak,
  ].join(':');
}

export type PuzzlePlayLayoutProps = {
  backToRoot: () => void;
  assistant: JSX.Element;
  boardSlot: (size: number) => JSX.Element;
  puzzleId?: string;
  puzzleRating?: number;
  status: Accessor<SolveStatus>;
  hintStage: Accessor<HintStage>;
  canGoBack: Accessor<boolean>;
  canGoForward: Accessor<boolean>;
  onHint: () => void;
  onSolution: () => void;
  onBack: () => void;
  onForward: () => void;
  onRetry: () => void;
  onNext: () => void;
  onFeedConfigApplied: () => void;
  completion: Accessor<PuzzleCompletion | null>;
  e2eHints?: JSX.Element;
  e2eLoadingStatus?: JSX.Element;
};

function puzzleRatingOrUndef(rating: number | undefined): number | undefined {
  if (rating !== undefined && rating > 0) return rating;
  return undefined;
}

function PuzzlePlayFeed(props: PlayChromeProps): JSX.Element {
  return (
    <ChessPuzzleFeedBar
      puzzleId={props.layout.puzzleId}
      rating={puzzleRatingOrUndef(props.layout.puzzleRating)}
      onOpenFeedSettings={props.openFeedSettings}
    />
  );
}

function PuzzlePlayActions(props: {
  layout: PuzzlePlayLayoutProps;
}): JSX.Element {
  const p = props.layout;
  return (
    <ChessPuzzleActionBar
      status={p.status()}
      hintStage={p.hintStage()}
      canGoBack={p.canGoBack()}
      canGoForward={p.canGoForward()}
      onHint={p.onHint}
      onSolution={p.onSolution}
      onBack={p.onBack}
      onForward={p.onForward}
      onRetry={p.onRetry}
      onNext={p.onNext}
    />
  );
}

function PuzzlePlayBoard(props: {
  boardSlot: (size: number) => JSX.Element;
}): JSX.Element {
  return (
    <ChessPuzzleBoardFrame>
      {(size) => props.boardSlot(size)}
    </ChessPuzzleBoardFrame>
  );
}

/**
 * Largest square that fits the pane. Leftover space stays around the island
 * (app background), not as a blank mat above a bottom-aligned board.
 */
function PuzzlePlayBoardWell(props: {
  boardSlot: (size: number) => JSX.Element;
}): JSX.Element {
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] overflow-hidden items-center justify-center self-stretch"
      style={{ 'container-type': 'size' }}
    >
      <Island
        class="overflow-hidden min-h-[0] min-w-[0] shrink"
        style={{
          width: 'min(100cqw, 100cqh)',
          height: 'min(100cqw, 100cqh)',
          'max-width': '100%',
          'max-height': '100%',
          padding: `${BOARD_WELL_PADDING_PX}px`,
        }}
      >
        <PuzzlePlayBoard boardSlot={props.boardSlot} />
      </Island>
    </div>
  );
}

/** Portal wraps extras in an unstyled div; stretch that parent so flex-1 chrome can fill the rail. */
function stretchPortalParent(el: HTMLElement): void {
  const parent = el.parentElement;
  if (parent === null) return;
  parent.classList.add(
    'box',
    'flex-1',
    'min-h-[0]',
    'min-w-[0]',
    'self-stretch'
  );
}

function PuzzlePlayRailColumn(props: PlayChromeProps): JSX.Element {
  const [root, setRoot] = createSignal<HTMLElement>();
  createEffect(() => {
    const el = root();
    if (el === undefined) return;
    stretchPortalParent(el);
    queueMicrotask(() => stretchPortalParent(el));
  });
  return (
    <div class="box flex-1 min-h-[0] min-w-[0] self-stretch" ref={setRoot}>
      <div class="box shrink-0 min-w-[0]">
        <PuzzlePlayFeed
          layout={props.layout}
          openFeedSettings={props.openFeedSettings}
        />
      </div>
      <div class="box flex-1 min-h-[0] min-w-[0] overflow-hidden justify-center">
        {props.layout.assistant}
      </div>
      <div class="box shrink-0">
        <ChessPuzzleMoveHistoryBar />
      </div>
      <div class="box shrink-0">
        <PuzzlePlayActions layout={props.layout} />
      </div>
    </div>
  );
}

function CelebrationLayer(props: {
  completion: Accessor<PuzzleCompletion | null>;
}): JSX.Element {
  const [dismissedKey, setDismissedKey] = createSignal<string | null>(null);
  const completion = createMemo(() => props.completion());
  const visible = createMemo(() => {
    const current = completion();
    if (current === null) return false;
    return dismissedKey() !== completionKey(current);
  });
  return (
    <Show when={completion()}>
      {(current) => (
        <ChessPuzzleCelebrationOverlay
          completion={current()}
          visible={visible()}
          onClose={() => setDismissedKey(completionKey(current()))}
          onDisplayEloChange={noopElo}
        />
      )}
    </Show>
  );
}

/** Phone: coach + square board + timeline/actions docked to the bottom. */
function PuzzlePlayStack(props: PlayChromeProps): JSX.Element {
  return (
    <div class="box flex-1 min-h-[0] min-w-[0] overflow-hidden">
      <div class="box shrink-0 min-w-[0]">
        <PuzzlePlayFeed
          layout={props.layout}
          openFeedSettings={props.openFeedSettings}
        />
        <div class="box shrink-0 min-w-[0] overflow-hidden">
          {props.layout.assistant}
        </div>
      </div>
      <PuzzlePlayBoardWell boardSlot={props.layout.boardSlot} />
      <div class="box shrink-0">
        <ChessPuzzleMoveHistoryBar />
      </div>
      <div class="box self-stretch shrink-0">
        <PuzzlePlayActions layout={props.layout} />
      </div>
    </div>
  );
}

/** Tablet: in-body board | chrome (space shell has no side rail). */
function PuzzlePlaySplit(props: PlayChromeProps): JSX.Element {
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] flex-row items-stretch overflow-hidden"
      style={{ gap: `${SHELL_GAP_PX}px` }}
    >
      <PuzzlePlayBoardWell boardSlot={props.layout.boardSlot} />
      <div
        class="box min-h-[0] shrink-0 self-stretch overflow-hidden"
        style={{ width: `${ISLAND_SIDE_RAIL_WIDTH}px` }}
      >
        <PuzzlePlayRailColumn
          layout={props.layout}
          openFeedSettings={props.openFeedSettings}
        />
      </div>
    </div>
  );
}

/** Desktop: board well + space side rail. */
function PuzzlePlayWide(props: PlayChromeProps): JSX.Element {
  return (
    <>
      <SpaceSideRailExtras>
        <PuzzlePlayRailColumn
          layout={props.layout}
          openFeedSettings={props.openFeedSettings}
        />
      </SpaceSideRailExtras>
      <PuzzlePlayBoardWell boardSlot={props.layout.boardSlot} />
    </>
  );
}

export function PuzzlePlayLayout(props: PuzzlePlayLayoutProps): JSX.Element {
  const [feedSettingsOpen, setFeedSettingsOpen] = createSignal(false);
  const openFeedSettings = (): void => {
    setFeedSettingsOpen(true);
  };
  const closeFeedSettings = (): void => {
    setFeedSettingsOpen(false);
  };
  const themeLayout = useThemeLayout();
  const shell = createMemo(() => {
    const bp = themeLayout.breakpoint();
    if (bp === 'desktop') return 'wide';
    if (bp === 'tablet') return 'split';
    return 'stack';
  });
  return (
    <div
      class="box flex-1 min-h-[0] min-w-[0] self-stretch overflow-hidden"
      data-testid="chess-puzzle-play-screen"
      data-screen="chess-puzzle-play"
    >
      <DefineBackButton onPress={props.backToRoot} />
      {props.e2eLoadingStatus}
      <Switch>
        <Match when={shell() === 'wide'}>
          <PuzzlePlayWide layout={props} openFeedSettings={openFeedSettings} />
        </Match>
        <Match when={shell() === 'split'}>
          <PuzzlePlaySplit layout={props} openFeedSettings={openFeedSettings} />
        </Match>
        <Match when={shell() === 'stack'}>
          <PuzzlePlayStack layout={props} openFeedSettings={openFeedSettings} />
        </Match>
      </Switch>
      <CelebrationLayer completion={props.completion} />
      {props.e2eHints}
      <ChessPuzzleFeedSettingsModal
        visible={feedSettingsOpen()}
        onClose={closeFeedSettings}
        onFeedConfigApplied={props.onFeedConfigApplied}
      />
    </div>
  );
}
