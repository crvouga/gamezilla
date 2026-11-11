import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import {
  DefineBackButton,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import { createEffect, type JSX } from 'solid-js';
import { useRefusalText } from './custom-game-error';
import { CUSTOM_GAME_PLACES } from './custom-game-places';
import { CustomGameSetupBoard } from './custom-game-private-setup';
import { frameConnection, useFrameStatus } from './custom-game-status';
import { CustomGameTest } from './custom-game-test';
import {
  FRAME_NO_NEXT,
  FRAME_NO_PLAY,
  FRAME_NO_TABLE,
} from './game-frame-empty';
import { FrameBoardMount, useFrameBoard } from './game-frame-play';
import { useFrameResult } from './game-frame-result';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from './game-frame-screen-view';
import type { FramePeople, FramePhase } from './game-frame-view-types';
import { useFrameWatcherCount } from './game-frame-watchers';
import { useCustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';
import { useCustomGameScreen } from './use-custom-game-screen';
import {
  useFrameBoardState,
  useFrameNext,
  useFramePlay,
  useFrameRecord,
} from './use-frame-play';
import { useFrameTable } from './use-frame-seats';
import { useFrameSetup } from './use-frame-setup';

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

const nothing = async (): Promise<void> => undefined;

/** The frame behind a denial: no game, nothing to do. */
const DENIED_FRAME = {
  phase: 'none',
  viewerSide: null,
  watchers: 0,
  connection: 'online',
  error: '',
  stopped: false,
  status: null,
  canCreate: false,
  playerCount: 2,
  setup: null,
  table: FRAME_NO_TABLE,
  play: FRAME_NO_PLAY,
  result: null,
  next: FRAME_NO_NEXT,
  record: null,
  onChoose: nothing,
  onReady: nothing,
  onPlayBot: nothing,
  onRandomSetup: nothing,
  onSeek: () => undefined,
  onReturnLive: () => undefined,
  onSelectRecord: () => undefined,
  onOpenHistory: () => undefined,
  place: CUSTOM_GAME_PLACES.home.none,
  onOpen: () => undefined,
  onClose: () => undefined,
} satisfies Omit<GameFrameScreenViewProps, 'title' | 'onBack'>;

type FrameProps = {
  model: CustomGameScreenModel;
  title: JSX.Element;
};

/**
 * The small screen this device shows: the game's phase is the stage, and
 * the place within it is the person's own. Back leads to the place behind,
 * and from a phase's home out to the game's choices. Leaving the moves
 * place returns the board to the game as it stands, so the play place only
 * ever shows the live position.
 */
function useCustomGamePlace(
  model: CustomGameScreenModel,
  review: ReturnType<typeof useCustomGameReview>
) {
  const phase = (): FramePhase => model.current()?.status ?? 'none';
  const navigation = useScreenPlace(CUSTOM_GAME_PLACES, phase);
  createEffect(() => {
    if (navigation.place().screen !== 'moves') review.returnLive();
  });
  return { phase, ...navigation };
}

/** Reads the room for `GameFrameScreenView`: the allowed custom game. */
function CustomGameFrame(props: FrameProps): JSX.Element {
  const model = props.model;
  const review = useCustomGameReview(model);
  const place = useCustomGamePlace(model, review);
  const choices = useGameChoicesName();
  const board = useFrameBoard(model, review);
  const refusal = useRefusalText();
  const status = useFrameStatus(model);
  const watchers = useFrameWatcherCount(model.current);
  const setup = useFrameSetup(model);
  const table = useFrameTable(model, board);
  const play = useFramePlay(model, board);
  const result = useFrameResult(model);
  const next = useFrameNext(model);
  const record = useFrameRecord(model, review);
  const boardState = useFrameBoardState(model, review, board);
  const presentation = useGamePresentation();
  const boardAlign = (): 'start' | undefined => {
    const game = model.current();
    return game === null ? undefined : presentation(game.fen).frame.boardAlign;
  };
  const boardFit = (): 'square' | undefined => {
    const game = model.current();
    return game === null ? undefined : presentation(game.fen).frame.boardFit;
  };
  return (
    <>
      {/* Back from a phase's home names where it leads: the game's choices. */}
      <DefineBackButton
        onPress={() => {
          if (!place.back()) model.back();
        }}
        label={
          place.place().screen === CUSTOM_GAME_PLACES.home[place.phase()].screen
            ? choices()
            : undefined
        }
      />
      <GameFrameScreenView
        title={props.title}
        phase={place.phase()}
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
        status={status()}
        canCreate={model.canCreate()}
        playerCount={model.playerCount()}
        setup={setup()}
        table={table()}
        play={play()}
        result={result()}
        next={next()}
        record={record()}
        board={<FrameBoardMount board={board} />}
        setupBoard={<CustomGameSetupBoard model={model} />}
        boardState={boardState()}
        boardFit={boardFit()}
        boardAlign={boardAlign()}
        people={PEOPLE}
        onChoose={model.choose}
        onReady={model.ready}
        onPlayBot={model.playBot}
        onRandomSetup={async () => model.privateSetup.random()}
        onBack={model.back}
        onSeek={review.seek}
        onReturnLive={review.returnLive}
        onSelectRecord={review.select}
        onOpenHistory={() => model.openHistory?.()}
      />
      <CustomGameTest model={model} review={review} />
    </>
  );
}

/** A game's custom game in a space: wires `GameFrameScreenView` to the room. */
export function CustomGameScreen(props: {
  gameId: string;
  onBack: () => void;
  title?: string;
  onHistory?: () => void;
}): JSX.Element {
  const model = useCustomGameScreen(
    props.onBack,
    () => props.gameId,
    props.onHistory
  );
  const title = (): JSX.Element => props.title ?? <Trans>Custom game</Trans>;
  const choices = useGameChoicesName();
  return (
    <>
      <DefineBackButton onPress={model.back} label={choices()} />
      <DecisionGate
        decision={model.watchDecision()}
        testId="custom-game-denial"
        denied={(denial) => (
          <GameFrameScreenView
            {...DENIED_FRAME}
            title={title()}
            denial={denial}
            onBack={model.back}
          />
        )}
      >
        <CustomGameFrame model={model} title={title()} />
      </DecisionGate>
    </>
  );
}
