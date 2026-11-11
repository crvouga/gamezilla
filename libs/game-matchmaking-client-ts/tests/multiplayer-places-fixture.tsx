/** @jsxImportSource solid-js */
/** `MultiplayerScreenView` moved by its own place machine, for tests. */

import { mock } from 'bun:test';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from '@libs/game-matchmaking-client-ts/multiplayer-game-view';
import { multiplayerOverlayPhase } from '@libs/game-matchmaking-client-ts/multiplayer-overlay-view';
import {
  MULTIPLAYER_PLACES,
  type MultiplayerPlace,
  type MultiplayerStage,
} from '@libs/game-matchmaking-client-ts/multiplayer-places';
import {
  MultiplayerScreenView,
  type MultiplayerScreenViewProps,
} from '@libs/game-matchmaking-client-ts/multiplayer-screen-view';
import { useMultiplayerPlaces } from '@libs/game-matchmaking-client-ts/use-multiplayer-places';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { NO_STAGE_OVERLAY } from '@pkgs/turn-game-client-ts/stage-overlay';
import { useStageOverlay } from '@pkgs/turn-game-client-ts/use-stage-overlay';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createSignal, type JSX } from 'solid-js';

const accepted = () => mock(() => Promise.resolve());

/** A two-player game in play, as the person to move may act on it. */
export const GAME: MultiplayerGameView = {
  players: 2,
  leave: 'resign',
  draw: 'offer',
  rematch: 'none',
  newOpponent: false,
  flip: { flipped: false },
  moves: {
    moves: [
      { ply: 1, san: 'e4', numbering: '1.', name: '1. e4' },
      { ply: 2, san: 'e5', numbering: '', name: '1... e5' },
    ],
    shownPly: 2,
    reviewing: null,
  },
  record: null,
};

/** The same game over with a result. */
export const FINISHED: MultiplayerGameView = {
  ...GAME,
  leave: null,
  draw: 'none',
  rematch: 'offer',
  newOpponent: true,
  record: { record: '1. e4 e5 1-0', finalPosition: 'final' },
};

function commands(): MultiplayerGameCommands {
  return {
    offerDraw: accepted(),
    acceptDraw: accepted(),
    declineDraw: accepted(),
    offerRematch: accepted(),
    acceptRematch: accepted(),
    declineRematch: accepted(),
    newOpponent: accepted(),
    ask: mock(() => undefined),
    flip: mock(() => undefined),
    chooseMove: mock(() => undefined),
    stepBack: mock(() => undefined),
    stepForward: mock(() => undefined),
    goToStart: mock(() => undefined),
    returnToCurrent: mock(() => undefined),
    copy: accepted(),
  };
}

type Overrides = Partial<
  Omit<MultiplayerScreenViewProps, 'stage' | 'place' | 'onOpen' | 'onBack'>
>;

function base(): Omit<
  MultiplayerScreenViewProps,
  'stage' | 'place' | 'onOpen' | 'onBack'
> {
  return {
    title: 'Connect Four',
    onLeave: mock(() => undefined),
    error: null,
    online: true,
    find: { players: 2, timed: false, timeControl: '5+0' },
    onChooseTimeControl: mock(() => undefined),
    onFind: accepted(),
    search: { players: 2, gameName: 'Chess', timeControl: '5+0', seconds: 3 },
    onStop: accepted(),
    ratings: [{ pool: 'game', rating: 1512, games: 7 }],
    game: GAME,
    commands: commands(),
    confirming: null,
    manyPlayers: false,
    onConfirm: accepted(),
    onCloseConfirm: mock(() => undefined),
    overlay: NO_STAGE_OVERLAY,
    onOverlay: mock(() => undefined),
    versus: {
      others: [{ id: 'black', name: 'Bob', avatar: null, caption: 'Yellow' }],
      own: [{ id: 'white', name: 'alice', avatar: null, caption: 'Red' }],
      clock: '5 min',
    },
    result: {
      tone: 'won',
      title: 'You won the multiplayer game.',
      caption: 'By resignation.',
    },
  };
}

/**
 * Mount the view in `stage`, on its home or on `open`, at a window `width`.
 * The returned handle changes the stage and the view's arguments, as the
 * data would, and reads the place shown.
 */
export function mountPlaces(options: {
  readonly stage: MultiplayerStage;
  readonly open?: Exclude<MultiplayerPlace['screen'], 'ratings'>;
  readonly width?: number;
  readonly props?: Overrides;
}) {
  const time = createHarnessClock();
  const [stage, setStage] = createSignal(options.stage);
  const [props, setProps] = createSignal({ ...base(), ...options.props });
  const [chosen, setChosen] = createSignal<string | null>(null);
  let overlay: ReturnType<typeof useStageOverlay>['overlay'] = () =>
    NO_STAGE_OVERLAY;
  let place: () => MultiplayerPlace = () => MULTIPLAYER_PLACES.home.idle;
  let back: () => boolean = () => false;
  function Places(): JSX.Element {
    const nav = useMultiplayerPlaces(stage, () =>
      props().commands.returnToCurrent()
    );
    // The board's overlay is the stage's own machine, on the harness clock.
    const over = useStageOverlay(
      () => multiplayerOverlayPhase(stage()),
      time.timers
    );
    overlay = over.overlay;
    if (options.open !== undefined) nav.open({ screen: options.open });
    place = nav.place;
    back = nav.back;
    return (
      <MultiplayerScreenView
        {...props()}
        stage={stage()}
        place={nav.place()}
        find={{
          ...props().find,
          timeControl: chosen() ?? props().find.timeControl,
        }}
        onChooseTimeControl={setChosen}
        onOpen={nav.open}
        onBack={() => nav.back()}
        overlay={over.overlay()}
        onOverlay={over.send}
        board={(card) => (
          <GameBoardStage overlay={card}>
            <p data-testid="slot-board">board</p>
          </GameBoardStage>
        )}
        status={<p data-testid="slot-status">status</p>}
        setup={<p data-testid="slot-setup">setup</p>}
      />
    );
  }
  const view = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: options.width ?? 390, height: 900 }}
      >
        <SurfaceStackProvider>
          <Places />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return {
    ...view,
    props,
    place: () => place().screen,
    /** The bar's Back: false from a stage's home, where it leaves. */
    back: () => back(),
    /** What lies over the board. */
    overlay: () => overlay(),
    /** The harness clock the versus card counts on. */
    time,
    setStage,
    set: (next: Overrides) => setProps((current) => ({ ...current, ...next })),
  };
}
