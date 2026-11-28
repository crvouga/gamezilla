import {
  gameSessionTerminal,
  type PlayMode,
} from '@libs/game-session-shared-ts/game-session-state';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import { dynamic, type JSX } from '@solidjs/web';
import { createEffect, Show } from 'solid-js';
import {
  FrameBoardMount,
  useBoardLineStatus,
  useFrameBoard,
} from './game-frame-play';
import { useFrameResult } from './game-frame-result';
import type { FramePeople, FramePhase } from './game-frame-view-types';
import { useFrameWatcherCount } from './game-frame-watchers';
import { GameSessionBack } from './game-session-back';
import { useRefusalText } from './game-session-error';
import { GAME_SESSION_PLACES } from './game-session-places';
import { GameSessionSetupBoard } from './game-session-private-setup';
import { frameConnection, useFrameStatus } from './game-session-status';
import { GameSessionTest } from './game-session-test';
import { PlayBotsScreenView } from './play-bots-screen-view';
import { PlayFriendScreenView } from './play-friend-screen-view';
import { SessionDenial } from './session-screen-view';
import {
  useFrameBoardState,
  useFrameNext,
  useFramePlay,
  useFrameRecord,
} from './use-frame-play';
import { useFrameTable } from './use-frame-seats';
import { useFrameSetup } from './use-frame-setup';
import { useGameSessionReview } from './use-game-session-review';
import type { GameSessionScreenModel } from './use-game-session-screen';
import { useGameSessionScreen } from './use-game-session-screen';

const views = {
  'vs-human': PlayFriendScreenView,
  'vs-bot': PlayBotsScreenView,
};

/** People at the table, as the app shows them: live usernames and pictures. */
const PEOPLE: FramePeople = {
  name: (person, bold) => (
    <UserUsername
      profileId={person}
      withAt={false}
      variant={bold === true ? 'bodyBold' : undefined}
    />
  ),
  avatar: (person, size) => (
    <UserProfileAvatar profileId={person} size={size} />
  ),
};

type FrameProps = {
  model: GameSessionScreenModel;
  title: JSX.Element;
  onBackFromBoard: (personal: boolean) => void;
  /** Which screen template draws the places. */
  mode: PlayMode;
};

/**
 * The small screen this device shows: the game's phase is the stage, and
 * the place within it is the person's own. Back leads to the place behind,
 * and from a phase's home out to the game's choices. Leaving the moves
 * place returns the board to the game as it stands, so the play place only
 * ever shows the live position.
 */
function useGameSessionPlace(
  model: GameSessionScreenModel,
  review: ReturnType<typeof useGameSessionReview>
) {
  const phase = (): FramePhase => model.current()?.status ?? 'none';
  const navigation = useScreenPlace(GAME_SESSION_PLACES, phase);
  createEffect(
    () => navigation.place().screen !== 'moves',
    (away) => {
      if (away) review.returnLive();
    }
  );
  return { phase, ...navigation };
}

/** What the game's own presentation says of the screen around its board. */
function useFramePresentationFacts(model: FrameProps['model']) {
  const presentation = useGamePresentation();
  const shown = () => {
    const game = model.current();
    return game === null ? undefined : presentation(game.fen);
  };
  return {
    /** How the game is won, in one sentence. */
    name: (): string | undefined => shown()?.name(),
    goal: (): string | undefined => shown()?.goal?.(),
    /** How the frame holds the board: its fit, alignment and workspace. */
    board: () => ({
      boardFit: shown()?.frame.boardFit,
      boardAlign: shown()?.frame.boardAlign,
      menuMatchCommands: shown()?.frame.menuMatchCommands,
      boardWorkspace: shown()?.frame.boardWorkspace === true,
    }),
  };
}

/**
 * The stage's one line: where the game stands, in the board's own words
 * while the game is played when it has some (`useBoardLineStatus`).
 */
function useStageStatus(
  model: GameSessionScreenModel,
  board: ReturnType<typeof useFrameBoard>
) {
  return useBoardLineStatus(
    useFrameStatus(model),
    board,
    () => model.current()?.status === 'active'
  );
}

function returnFromGameSession(
  model: GameSessionScreenModel,
  backFromBoard: FrameProps['onBackFromBoard']
) {
  return (): void => {
    if (model.current() === null || model.current()?.status === 'configuring')
      model.back();
    else backFromBoard(model.underWay() || !model.connected());
  };
}

function finishedOtherMode(props: FrameProps): boolean {
  const game = props.model.current();
  return game !== null && gameSessionTerminal(game) && game.mode !== props.mode;
}

/** Reads the room into the screen template this visit uses. */
function GameSessionFrame(props: FrameProps): JSX.Element {
  const model = props.model;
  const review = useGameSessionReview(model);
  const place = useGameSessionPlace(model, review);
  const board = useFrameBoard(model, review);
  const refusal = useRefusalText();
  const status = useStageStatus(model, board);
  const watchers = useFrameWatcherCount(model.current);
  const setup = useFrameSetup(model);
  const table = useFrameTable(model, board);
  const play = useFramePlay(model, board);
  const result = useFrameResult(model);
  const next = useFrameNext(model);
  const record = useFrameRecord(model, review);
  const boardState = useFrameBoardState(model, review, board);
  const shown = useFramePresentationFacts(model);
  const previousMode = () => finishedOtherMode(props);
  const mode = () =>
    previousMode() ? props.mode : (model.current()?.mode ?? props.mode);
  const Screen = dynamic(() => views[mode()]);
  const leave = returnFromGameSession(model, props.onBackFromBoard);
  return (
    <>
      <GameSessionBack
        game={model.current()}
        canResign={play().canResign || play().heldResign}
        backWithinGame={place.back}
        leave={leave}
        resign={() => model.choose({ operation: 'resign' })}
      />
      <Screen
        title={shown.name() ?? props.title}
        goal={shown.goal()}
        phase={previousMode() ? 'none' : place.phase()}
        place={place.place()}
        onOpen={place.open}
        onClose={() => {
          place.back();
        }}
        viewerSide={model.mySide()}
        watchers={watchers()}
        connection={frameConnection(model)}
        error={refusal(model.error(), model.current()?.fen)}
        stopped={model.simulation.error()}
        onReopen={() => model.simulation.restart()}
        status={status()}
        canCreate={model.canCreate()}
        sides={model.sides()}
        setup={setup()}
        table={table()}
        play={play()}
        result={result()}
        next={next()}
        record={record()}
        board={<FrameBoardMount board={board} />}
        setupBoard={<GameSessionSetupBoard model={model} />}
        boardState={boardState()}
        {...shown.board()}
        people={PEOPLE}
        onChoose={model.choose}
        onReady={model.ready}
        onRandomSetup={async () => {
          model.privateSetup.random();
        }}
        onBack={leave}
        onSeek={review.seek}
        onReturnLive={review.returnLive}
        onSelectRecord={review.select}
        onOpenHistory={() => model.openHistory?.()}
      />
      <GameSessionTest model={model} review={review} />
    </>
  );
}

export type PlayScreenProps = {
  gameId: string;
  onBack: () => void;
  title?: string;
  onHistory?: () => void;
  onBackFromBoard: (personal: boolean) => void;
};

type WiredPlay = {
  readonly mode: PlayMode;
  readonly fallbackTitle: JSX.Element;
};

export function WiredPlayScreen(
  props: PlayScreenProps & WiredPlay
): JSX.Element {
  const spaceId = useSpaceRoomSessionId();
  return (
    <Show when={spaceId()} keyed>
      {(_room) => <RoomPlayScreen {...props} />}
    </Show>
  );
}

function RoomPlayScreen(props: PlayScreenProps & WiredPlay): JSX.Element {
  const model = useGameSessionScreen(
    props.onBack,
    () => props.gameId,
    props.onHistory
  );
  const title = (): JSX.Element => props.title ?? props.fallbackTitle;
  const choices = useGameChoicesName();
  return (
    <>
      <DecisionGate
        decision={model.watchDecision()}
        testId="game-session-denial"
        denied={(denial) => (
          <>
            <DefineBackButton onPress={model.back} label={choices()} />
            <SessionDenial mode={props.mode} title={title()} denial={denial} />
          </>
        )}
      >
        <GameSessionFrame
          model={model}
          title={title()}
          onBackFromBoard={props.onBackFromBoard}
          mode={props.mode}
        />
      </DecisionGate>
    </>
  );
}
