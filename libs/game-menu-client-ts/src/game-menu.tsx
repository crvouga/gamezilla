import { LINKED_MULTIPLAYER_PARAM } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import type { GamePuzzlesClient } from '@libs/game-puzzle-client-ts/puzzle-client';
import { PuzzleFrame } from '@libs/game-puzzle-client-ts/puzzle-frame';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useSpaceSessionUi } from '@libs/spaces-client-ts/space-session-ui-context';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import type { GameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client-ts/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, Show, untrack } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { GameClient } from './game-client';
import { gameChoices, type Offers, sharedScreens } from './game-menu-choices';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

function GameChoices(props: {
  game: GameClient;
  offers: Offers;
  navigation: GameScreen;
  onBackToGames: () => void;
}): JSX.Element {
  const items = createMemo((): MainMenuItem[] =>
    gameChoices(props.game, props.offers).map((choice) => ({
      key: choice.screen,
      title: <Dynamic component={choice.title} />,
      caption: <Dynamic component={choice.caption} />,
      dataSet: { testid: Handles.gameChoice(choice.screen) },
      onClick: () => props.navigation.show(choice.screen),
    }))
  );
  return (
    <>
      <DefineBackButton onPress={props.onBackToGames} />
      <MainMenuScreen
        screenId="game-choices"
        dataSet={{ testid: Handles.gameChoices }}
        title={props.game.title}
        subtitle={<Dynamic component={props.game.subtitle} />}
        items={items()}
        helper={
          props.game.instructions === undefined ? undefined : (
            <P variant="caption" tone="secondary">
              <Dynamic component={props.game.instructions} />
            </P>
          )
        }
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

function PassThrough(props: { children: JSX.Element }): JSX.Element {
  return <>{props.children}</>;
}

/**
 * Everything around the game's screens: the platform's puzzle frame (the
 * feed, a puzzle link) for a game offering puzzles, then the game's own.
 */
function GameFrame(props: {
  game: GameClient;
  children: JSX.Element;
}): JSX.Element {
  const own = (): JSX.Element => (
    <Dynamic component={props.game.Frame ?? PassThrough}>
      {props.children}
    </Dynamic>
  );
  return (
    <Show when={props.game.puzzles} keyed fallback={own()}>
      {(puzzles: GamePuzzlesClient) => (
        <PuzzleFrame gameId={props.game.shared.id} puzzles={puzzles}>
          {own()}
        </PuzzleFrame>
      )}
    </Show>
  );
}

/**
 * The selected game in a space: its choices and every screen they open,
 * shown alike to everyone in the space. The same component serves every
 * game; the game supplies its definition and the capabilities its shared
 * registration declares decide which shared screens exist.
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
        [
          ...(props.game.choices ?? []),
          ...sharedScreens(props.game, offers, navigation),
          ...(props.game.settings === undefined
            ? []
            : [
                {
                  screen: SHARED_GAME_SCREEN.settings,
                  Screen: props.game.settings.Screen,
                },
              ]),
          ...(props.game.screens ?? []),
        ].map((entry) => [entry.screen, entry.Screen])
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
        <FadeSwitch stateKey={navigation.screen()}>
          <Dynamic component={shown()} />
        </FadeSwitch>
      </StackVertical>
    </GameFrame>
  );
}
