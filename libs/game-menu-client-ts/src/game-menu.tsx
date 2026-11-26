import { LINKED_MULTIPLAYER_PARAM } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import type { GamePuzzlesClient } from '@libs/game-puzzle-client-ts/puzzle-client';
import { PuzzleFrame } from '@libs/game-puzzle-client-ts/puzzle-frame';
import { CustomGameSeatsNote } from '@libs/game-session-client-ts/custom-game-seats-note';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { SpaceOffer } from '@libs/spaces-client-ts/space-offer-context';
import { spaceDetailHref } from '@libs/spaces-client-ts/space-routes';
import { useSpaceSessionUi } from '@libs/spaces-client-ts/space-session-ui-context';
import {
  DefineBackButton,
  GameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import type { GameScreen } from '@libs/spaces-client-ts/use-game-screen';
import {
  GameScreenProvider,
  useVisitedGameScreen,
} from '@libs/spaces-client-ts/use-game-screen';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import type { GameModeOption } from '@libs/spaces-shared-ts/game';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import {
  useLocalSearchParams,
  useRouter,
} from '@pkgs/ui-root-client-ts/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client-ts/fade-switch';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { dynamic, type JSX } from '@solidjs/web';
import { createEffect, createMemo, Show } from 'solid-js';
import type { GameClient } from './game-client';
import { GameHomeScreenView } from './game-home-screen-view';
import { gameChoices, type Offers, sharedScreens } from './game-menu-choices';
import { GAME_MENU_PLACES } from './game-menu-places';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

function GameChoices(props: {
  game: GameClient;
  offers: Offers;
  navigation: GameScreen;
  onBackToGames: () => void;
  modes?: readonly GameModeOption[] | undefined;
  onChooseMode?: ((id: string) => void) | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const nav = useScreenPlace(GAME_MENU_PLACES, () => 'open' as const);
  const choices = createMemo(() =>
    gameChoices(props.game, props.offers).map((choice) => {
      const Title = choice.title;
      const Caption = choice.caption;
      return { screen: choice.screen, title: <Title />, caption: <Caption /> };
    })
  );
  const Subtitle = dynamic(() => props.game.subtitle);
  return (
    <>
      {/* Back names where it goes: the space's list of games, or the menu. */}
      <DefineBackButton
        onPress={() => {
          if (!nav.back()) props.onBackToGames();
        }}
        label={nav.place().screen === 'home' ? t`Games` : props.game.title}
      />
      <GameHomeScreenView
        title={props.game.title}
        tile={props.game.tile}
        subtitle={<Subtitle />}
        lesson={props.game.lesson}
        choices={choices()}
        onChoose={(screen) => props.navigation.show(screen)}
        place={nav.place()}
        onOpen={nav.open}
        modes={props.modes}
        mode={props.game.shared.id}
        onChooseMode={props.onChooseMode}
      />
    </>
  );
}

/**
 * A space opened from a game's multiplayer link goes straight to finding an
 * opponent for its host — once, so going back still leads to the choices.
 * The link is spent as it is followed: the address keeps only the space, so
 * reopening the app or coming back to the space on this device leaves the
 * space on whatever it shows by then.
 */
function useOpenLinkedMultiplayer(
  navigation: GameScreen,
  offered: () => boolean
): void {
  const params = useLocalSearchParams<{ multiplayer?: string | undefined }>();
  const router = useRouter();
  const session = useSpaceSessionUi();
  const isHost = useSpaceCan(
    () => session.spaceId,
    PERMISSION.spacesSelectGame
  );
  let opened = false;
  createEffect(
    () => ({
      linked:
        params()[LINKED_MULTIPLAYER_PARAM] !== undefined &&
        offered() &&
        isHost(),
      spaceId: session.spaceId,
      screen: navigation.screen(),
    }),
    ({ linked, spaceId, screen }) => {
      if (!linked || opened) return;
      opened = true;
      if (screen !== SHARED_GAME_SCREEN.matchmakingHome)
        navigation.show(SHARED_GAME_SCREEN.matchmakingHome);
      router.replace(spaceDetailHref(spaceId));
    }
  );
}

/**
 * Everything around the game's screens: the platform's puzzle frame (the
 * feed, a puzzle link) for a game offering puzzles.
 */
function GameFrame(props: {
  game: GameClient;
  children: JSX.Element;
}): JSX.Element {
  return (
    <Show when={props.game.puzzles} keyed fallback={props.children}>
      {(puzzles: GamePuzzlesClient) => (
        <PuzzleFrame gameId={props.game.shared.id} puzzles={puzzles}>
          {props.children}
        </PuzzleFrame>
      )}
    </Show>
  );
}

/**
 * The selected game in a space: its choices and every template screen they
 * open, shown alike to everyone in the space. The same component serves
 * every game; the game supplies its definition, and the capabilities its
 * shared registration declares and the settings it declares as data decide
 * which template screens exist. No screen is the game's own.
 */
type GameMenuProps = {
  game: GameClient;
  onBackToGames: () => void;
  /** The game's modes, when it has several; switching one sets it up instead. */
  modes?: readonly GameModeOption[] | undefined;
  onChooseMode?: ((id: string) => void) | undefined;
};

function GameMenuContent(props: GameMenuProps): JSX.Element {
  const navigation = useVisitedGameScreen();
  const offers: Offers = (capability) =>
    props.game.shared.registration?.capabilities[capability] !== undefined;
  useOpenLinkedMultiplayer(navigation, () => offers('matchmaking'));
  const screens = createMemo(
    () =>
      new Map(
        sharedScreens(props.game, offers, navigation).map((entry) => [
          entry.screen,
          entry.Screen,
        ])
      )
  );
  const choices = () => (
    <GameChoices
      game={props.game}
      offers={offers}
      navigation={navigation}
      onBackToGames={props.onBackToGames}
      modes={props.modes}
      onChooseMode={props.onChooseMode}
    />
  );
  const Shown = dynamic(() => screens().get(navigation.screen()) ?? choices);
  return (
    <GameFrame game={props.game}>
      <CustomGameSeatsNote />
      <StackVertical grow self="stretch">
        {/* What another sub offers over the space (the way back to a game). */}
        <SpaceOffer />
        {/* A Back from a screen the choices open names them by the game. */}
        <GameChoicesName name={props.game.title}>
          <FadeSwitch stateKey={navigation.screen()}>
            <Shown />
          </FadeSwitch>
        </GameChoicesName>
      </StackVertical>
    </GameFrame>
  );
}

export function GameMenu(props: GameMenuProps): JSX.Element {
  return (
    <GameScreenProvider game={props.game.shared.id}>
      <GameMenuContent {...props} />
    </GameScreenProvider>
  );
}
