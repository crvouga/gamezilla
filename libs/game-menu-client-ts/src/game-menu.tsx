import { LINKED_MULTIPLAYER_PARAM } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import type { GamePuzzlesClient } from '@libs/game-puzzle-client-ts/puzzle-client';
import { PuzzleFrame } from '@libs/game-puzzle-client-ts/puzzle-frame';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useSpaceSessionUi } from '@libs/spaces-client-ts/space-session-ui-context';
import {
  DefineBackButton,
  GameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import type { GameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import { useLingui } from '@lingui/solid/macro';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client-ts/fade-switch';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, Show, untrack } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { GameClient } from './game-client';
import { gameChoices, type Offers, sharedScreens } from './game-menu-choices';
import { GAME_MENU_PLACES } from './game-menu-places';
import { GameMenuScreenView } from './game-menu-screen-view';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

function GameChoices(props: {
  game: GameClient;
  offers: Offers;
  navigation: GameScreen;
  onBackToGames: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const nav = useScreenPlace(GAME_MENU_PLACES, () => 'open' as const);
  const choices = createMemo(() =>
    gameChoices(props.game, props.offers).map((choice) => ({
      screen: choice.screen,
      title: <Dynamic component={choice.title} />,
      caption: <Dynamic component={choice.caption} />,
    }))
  );
  return (
    <>
      {/* Back names where it goes: the space's list of games, or the menu. */}
      <DefineBackButton
        onPress={() => {
          if (!nav.back()) props.onBackToGames();
        }}
        label={nav.place().screen === 'menu' ? t`Games` : props.game.title}
      />
      <GameMenuScreenView
        title={props.game.title}
        tile={props.game.tile}
        subtitle={<Dynamic component={props.game.subtitle} />}
        instructions={
          props.game.instructions === undefined ? undefined : (
            <Dynamic component={props.game.instructions} />
          )
        }
        choices={choices()}
        onChoose={(screen) => props.navigation.show(screen)}
        place={nav.place()}
        onOpen={nav.open}
      />
    </>
  );
}

/**
 * A space opened from a game's multiplayer link goes straight to finding an
 * opponent for its host — once, so going back still leads to the choices.
 */
function useOpenLinkedMultiplayer(
  navigation: GameScreen,
  offered: () => boolean
): void {
  const params = useLocalSearchParams<{ multiplayer?: string | undefined }>();
  const { spaceId } = useSpaceSessionUi();
  const isHost = useSpaceCan(spaceId, PERMISSION.spacesSelectGame);
  let opened = false;
  createEffect(() => {
    if (params()[LINKED_MULTIPLAYER_PARAM] === undefined) return;
    if (!offered() || !isHost() || opened) return;
    opened = true;
    if (untrack(navigation.screen) !== SHARED_GAME_SCREEN.matchmaking)
      navigation.show(SHARED_GAME_SCREEN.matchmaking);
  });
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
export function GameMenu(props: {
  game: GameClient;
  onBackToGames: () => void;
}): JSX.Element {
  const navigation = useGameScreen();
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
    />
  );
  const shown = createMemo(() => screens().get(navigation.screen()) ?? choices);
  return (
    <GameFrame game={props.game}>
      <StackVertical grow self="stretch">
        {/* A Back from a screen the choices open names them by the game. */}
        <GameChoicesName name={props.game.title}>
          <FadeSwitch stateKey={navigation.screen()}>
            <Dynamic component={shown()} />
          </FadeSwitch>
        </GameChoicesName>
      </StackVertical>
    </GameFrame>
  );
}
