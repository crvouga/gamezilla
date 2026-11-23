import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useGameGoal } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useStageOverlay } from '@pkgs/turn-game-client-ts/use-stage-overlay';
import { type JSX, Show } from 'solid-js';
import { MultiplayerBoard, MultiplayerGameStatus } from './multiplayer-board';
import {
  multiplayerResultShown,
  useMultiplayerVersus,
} from './multiplayer-outcome';
import { multiplayerOverlayPhase } from './multiplayer-overlay-view';
import { MULTIPLAYER_PLACES } from './multiplayer-places';
import { MultiplayerPrivateSetupPanel } from './multiplayer-private-setup';
import { useMultiplayerRatings } from './multiplayer-ratings';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import { useDeadlineSettle } from './use-deadline-settle';
import { useLowOnTime, useLowOnTimeWarning } from './use-low-on-time';
import { useMultiplayerControls } from './use-multiplayer-controls';
import { useMultiplayerData } from './use-multiplayer-data';
import {
  useMultiplayerGameCommands,
  useMultiplayerGameView,
} from './use-multiplayer-game-view';
import { useMultiplayerHand } from './use-multiplayer-hand';
import {
  useMultiplayerConfirm,
  useMultiplayerFind,
  useMultiplayerPlaces,
  useMultiplayerStage,
} from './use-multiplayer-places';
import { useMultiplayerPrivateSetup } from './use-multiplayer-private-setup';
import { useMultiplayerSearch } from './use-multiplayer-search';
import type { OwnBoard } from './use-own-board';
import { useOwnBoard } from './use-own-board';

type ScreenProps = {
  readonly title: string;
  readonly data: ReturnType<typeof useMultiplayerData>;
  readonly controls: ReturnType<typeof useMultiplayerControls>;
  readonly view: OwnBoard;
  /** Leaves finding an opponent for the game's choices. */
  readonly onLeave: () => void;
};

/** A placeholder for "no denial", which resolves to nothing shown. */
const ALLOWED: Decision = { allowed: true, policyVersion: '' };

/** A decision resolved to the view's denial, or `undefined` while allowed. */
function useDenial(
  decision: () => Decision | null,
  testId: string
): () => ReturnType<ReturnType<typeof useDenialView>> | undefined {
  const view = useDenialView({
    get decision() {
      return decision() ?? ALLOWED;
    },
    testId,
  });
  return () => {
    const current = decision();
    return current === null || current.allowed ? undefined : view();
  };
}

/** Whether the person may see this space's game, or its host's search. */
function useMultiplayerAccess(data: ScreenProps['data']) {
  const decision = useDecision(PERMISSION.gameMultiplayerWatch, () => ({
    spacePresence:
      data.hostId() === data.myId() ? 'host' : data.hostId() ? 'guest' : null,
  }));
  const searchDecision = useDecision(PERMISSION.matchmakingView);
  return useDenial(
    () =>
      data.game() !== null || data.hostId() !== data.myId()
        ? decision()
        : searchDecision(),
    'multiplayer-access-denial'
  );
}

/**
 * The low on time warning sounds whichever place the device shows, so it
 * belongs to the screen and not to the board.
 */
function LowOnTimeWarning(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
}): JSX.Element {
  const low = useLowOnTime(() => props.game);
  useLowOnTimeWarning({
    game: () => props.game,
    myId: () => props.myId,
    low,
  });
  return null;
}

/**
 * The matched game's stage, the view's `board` slot. Only the moves show
 * an earlier position: every other place shows the game as it stands.
 */
function MatchBoard(
  props: ScreenProps & {
    readonly reviewing: boolean;
    /** What lies over the board: the versus card, the result card. */
    readonly overlay: JSX.Element;
    readonly setup: ReturnType<typeof useMultiplayerPrivateSetup>;
  }
): JSX.Element {
  const sync = useSyncEngine();
  const hand = useMultiplayerHand(props.data.game, props.data.myId);
  const live = (): OwnBoard => ({ ...props.view, earlier: () => null });
  return (
    <Show when={props.data.game()}>
      {(game) => (
        <MultiplayerBoard
          ownSetup={props.setup.own()}
          ownHand={hand()}
          game={game()}
          room={props.data.room()}
          myId={props.data.myId()}
          connected={sync.status().online}
          moving={props.controls.moving()}
          syncKey={props.controls.boardSync()}
          view={props.reviewing ? props.view : live()}
          overlay={props.overlay}
          onMove={props.controls.play}
        />
      )}
    </Show>
  );
}

/** What the screen reads beside the game and the search: access, refusals, the stage. */
function useMultiplayerScreen(props: ScreenProps) {
  const denial = useMultiplayerAccess(props.data);
  const stage = useMultiplayerStage(props.data, () => denial() !== undefined);
  const goal = useGameGoal();
  return {
    denial,
    stage,
    goal: () => goal(props.data.gameId()),
    /** How the game ended, once it has. */
    result: () => {
      const game = props.data.game();
      return game === null || game.outcome === 'ongoing'
        ? undefined
        : multiplayerResultShown(game, props.data.myId());
    },
    // An opponent found on this device plays the versus card; the end of
    // the game lays its result over the final board.
    overlay: useStageOverlay(
      () => multiplayerOverlayPhase(stage()),
      useTimers()
    ),
    versus: useMultiplayerVersus(props.data.game, props.data.myId),
    nav: useMultiplayerPlaces(stage, props.view.returnToCurrent),
    commandDenial: useDenial(
      props.controls.denial,
      'multiplayer-command-denial'
    ),
    confirm: useMultiplayerConfirm(props.data, props.controls),
    search: useMultiplayerSearch(props.data.search),
    ratings: useMultiplayerRatings(props.data.gameId, props.data.ratings),
    setup: useMultiplayerPrivateSetup(props.data.game, props.data.myId),
    finding: useMultiplayerFind(props.data),
    game: useMultiplayerGameView(props.data, props.view),
  };
}

/** The one line about the matched game, under its board. */
function MatchStatus(props: Pick<ScreenProps, 'data'>): JSX.Element {
  return (
    <Show when={props.data.game()}>
      {(game) => (
        <MultiplayerGameStatus game={game()} myId={props.data.myId()} />
      )}
    </Show>
  );
}

/** Reads matchmaking for `MultiplayerScreenView`. */
function MultiplayerContent(props: ScreenProps): JSX.Element {
  const data = props.data;
  const controls = props.controls;
  const sync = useSyncEngine();
  const screen = useMultiplayerScreen(props);
  const nav = screen.nav;
  const commands = useMultiplayerGameCommands(
    controls,
    props.view,
    screen.confirm.open
  );
  const choices = useGameChoicesName();
  const home = () =>
    nav.place().screen === MULTIPLAYER_PLACES.home[screen.stage()].screen;
  useDeadlineSettle({
    game: data.game,
    stored: data.stored,
    online: () => sync.status().online,
    settle: controls.settle,
  });
  return (
    <>
      <DefineBackButton
        onPress={() => {
          if (!nav.back()) props.onLeave();
        }}
        label={home() ? choices() : undefined}
      />
      <Show when={data.game()}>
        {(game) => <LowOnTimeWarning game={game()} myId={data.myId()} />}
      </Show>
      <MultiplayerScreenView
        title={props.title}
        goal={screen.goal()}
        stage={screen.stage()}
        place={nav.place()}
        onOpen={nav.open}
        onBack={() => nav.back()}
        onLeave={props.onLeave}
        denial={screen.denial()}
        commandDenial={screen.commandDenial()}
        error={controls.error()}
        online={sync.status().online}
        find={screen.finding.find()}
        onChooseTimeControl={screen.finding.choose}
        onFind={controls.begin}
        search={screen.search()}
        onStop={controls.stop}
        ratings={screen.ratings()}
        game={screen.game()}
        commands={commands}
        confirming={screen.confirm.confirming()}
        manyPlayers={screen.confirm.manyPlayers()}
        onConfirm={screen.confirm.run}
        onCloseConfirm={screen.confirm.close}
        setup={
          <Show when={data.game()}>
            {(game) => (
              <MultiplayerPrivateSetupPanel
                game={game()}
                setup={screen.setup}
                onChoose={controls.chooseSetup}
              />
            )}
          </Show>
        }
        board={(overlay) => (
          <MatchBoard
            {...props}
            setup={screen.setup}
            reviewing={nav.place().screen === 'moves'}
            overlay={overlay}
          />
        )}
        status={<MatchStatus data={data} />}
        overlay={screen.overlay.overlay()}
        onOverlay={screen.overlay.send}
        versus={screen.versus()}
        result={screen.result()}
      />
    </>
  );
}

/** A game's Find an opponent screen: wires `MultiplayerScreenView` to matchmaking. */
export default function MultiplayerScreen(props: {
  gameId: string;
  onBack: () => void;
  title: string;
}): JSX.Element {
  const data = useMultiplayerData(() => props.gameId);
  const controls = useMultiplayerControls(data);
  const view = useOwnBoard(data.game);
  return (
    <MultiplayerContent
      title={props.title}
      data={data}
      controls={controls}
      view={view}
      onLeave={props.onBack}
    />
  );
}
