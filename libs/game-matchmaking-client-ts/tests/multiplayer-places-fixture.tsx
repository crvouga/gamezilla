/** @jsxImportSource solid-js */
/** `MultiplayerScreenView` moved by its own place machine, for tests. */

import { mock } from 'bun:test';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from '@libs/game-matchmaking-client-ts/multiplayer-game-view';
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
  let place: () => MultiplayerPlace = () => MULTIPLAYER_PLACES.home.idle;
  let back: () => boolean = () => false;
  function Places(): JSX.Element {
    const nav = useMultiplayerPlaces(stage, () =>
      props().commands.returnToCurrent()
    );
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
        board={<p data-testid="slot-board">board</p>}
        setup={<p data-testid="slot-setup">setup</p>}
        outcome={<p data-testid="slot-outcome">outcome</p>}
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
    setStage,
    set: (next: Overrides) => setProps((current) => ({ ...current, ...next })),
  };
}
