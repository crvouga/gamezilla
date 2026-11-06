import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type JSX, Show } from 'solid-js';
import { MultiplayerBoard } from './multiplayer-board';
import {
  multiplayerStage,
  useMultiplayerConfirm,
  useMultiplayerNext,
} from './multiplayer-controls';
import { MultiplayerGameActions } from './multiplayer-game-actions';
import { MultiplayerMoves } from './multiplayer-moves';
import { MultiplayerPrivateSetupPanel } from './multiplayer-private-setup';
import { useMultiplayerRatings } from './multiplayer-ratings';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import { useDeadlineSettle } from './use-deadline-settle';
import { useMultiplayerControls } from './use-multiplayer-controls';
import { useMultiplayerData } from './use-multiplayer-data';
import { useMultiplayerHand } from './use-multiplayer-hand';
import { useMultiplayerPrivateSetup } from './use-multiplayer-private-setup';
import type { OwnBoard } from './use-own-board';
import { useOwnBoard } from './use-own-board';

type ScreenProps = {
  readonly title: string;
  readonly data: ReturnType<typeof useMultiplayerData>;
  readonly controls: ReturnType<typeof useMultiplayerControls>;
  readonly view: OwnBoard;
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

/** The matched game's commands, the view's `gameActions` slot. */
function MatchActions(props: {
  readonly data: ScreenProps['data'];
  readonly controls: ScreenProps['controls'];
  readonly onConfirm: (kind: 'resign' | 'abort') => void;
}): JSX.Element {
  return (
    <Show when={props.data.game()}>
      {(game) => (
        <MultiplayerGameActions
          game={game()}
          execution={props.data.execution()}
          myId={props.data.myId()}
          controls={props.controls}
          looking={props.data.search()?.standing === 'waiting'}
          onConfirm={props.onConfirm}
        />
      )}
    </Show>
  );
}

/** The matched game's moves, the view's `moves` slot. */
function MatchMoves(props: {
  readonly data: ScreenProps['data'];
  readonly view: OwnBoard;
}): JSX.Element {
  return (
    <Show when={props.data.game()}>
      {(game) => <MultiplayerMoves game={game()} view={props.view} />}
    </Show>
  );
}

/** Reads matchmaking for `MultiplayerScreenView`. */
function MultiplayerContent(props: ScreenProps): JSX.Element {
  const data = props.data;
  const controls = props.controls;
  const sync = useSyncEngine();
  const denial = useMultiplayerAccess(data);
  const commandDenial = useDenial(
    controls.denial,
    'multiplayer-command-denial'
  );
  const next = useMultiplayerNext(data);
  const confirm = useMultiplayerConfirm(data, controls);
  const ratings = useMultiplayerRatings(data.gameId, data.ratings);
  const setup = useMultiplayerPrivateSetup(data.game, data.myId);
  const hand = useMultiplayerHand(data.game, data.myId);
  useDeadlineSettle({
    game: data.game,
    stored: data.stored,
    online: () => sync.status().online,
    settle: controls.settle,
  });
  return (
    <MultiplayerScreenView
      title={props.title}
      denial={denial()}
      stage={multiplayerStage(data)}
      next={next()}
      commandDenial={commandDenial()}
      error={controls.error()}
      online={sync.status().online}
      ratings={ratings()}
      confirming={confirm.confirming()}
      manyPlayers={confirm.manyPlayers()}
      setupPanel={
        <Show when={data.game()}>
          {(game) => (
            <MultiplayerPrivateSetupPanel
              game={game()}
              setup={setup}
              onChoose={controls.chooseSetup}
            />
          )}
        </Show>
      }
      board={
        <Show when={data.game()}>
          {(game) => (
            <MultiplayerBoard
              ownSetup={setup.own()}
              ownHand={hand()}
              game={game()}
              room={data.room()}
              myId={data.myId()}
              connected={sync.status().online}
              moving={controls.moving()}
              syncKey={controls.boardSync()}
              view={props.view}
              onMove={controls.play}
            />
          )}
        </Show>
      }
      gameActions={
        <MatchActions
          data={data}
          controls={controls}
          onConfirm={confirm.open}
        />
      }
      moves={<MatchMoves data={data} view={props.view} />}
      onFind={controls.begin}
      onStop={controls.stop}
      onConfirm={confirm.run}
      onCloseConfirm={confirm.close}
    />
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
  const choices = useGameChoicesName();
  return (
    <>
      <DefineBackButton onPress={props.onBack} label={choices()} />
      <MultiplayerContent
        title={props.title}
        data={data}
        controls={controls}
        view={view}
      />
    </>
  );
}
