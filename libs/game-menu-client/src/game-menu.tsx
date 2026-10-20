import MultiplayerScreen from '@libs/game-matchmaking-client/multiplayer-screen';
import { LINKED_MULTIPLAYER_PARAM } from '@libs/game-matchmaking-shared/multiplayer-link';
import type { GamePuzzlesClient } from '@libs/game-puzzle-client/puzzle-client';
import { PuzzleFrame } from '@libs/game-puzzle-client/puzzle-frame';
import { PuzzlePlayScreen } from '@libs/game-puzzle-client/puzzle-play-screen';
import { PuzzleReviewScreen } from '@libs/game-puzzle-client/puzzle-review-screen';
import { PuzzleStatsScreen } from '@libs/game-puzzle-client/puzzle-stats-screen';
import { CustomGameScreen } from '@libs/game-session-client/custom-game-screen';
import { GameHistory } from '@libs/game-session-client/game-history';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useSpaceSessionUi } from '@libs/spaces-client/space-session-ui-context';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import type { GameScreen } from '@libs/spaces-client/use-game-screen';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { useSpaceCan } from '@libs/spaces-client/use-space-can';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import type { GameCapability } from '@pkgs/turn-game-shared/game-rules';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { FadeSwitch } from '@pkgs/ui-root-client/fade-switch';
import type { MainMenuItem } from '@pkgs/ui-root-client/main-menu-item-row';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import type { JSX } from 'solid-js';
import { createEffect, createMemo, Show, untrack } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { GameChoice, GameClient, GameOwnScreen } from './game-client';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

type Offers = (capability: GameCapability) => boolean;

function sharedScreens(
  game: GameClient,
  offers: Offers,
  navigation: GameScreen
): readonly GameOwnScreen[] {
  const back = navigation.showChoices;
  const id = game.shared.id;
  const history = offers('history')
    ? { onHistory: () => navigation.show(SHARED_GAME_SCREEN.history) }
    : {};
  return [
    ...(game.puzzles === undefined ? [] : PUZZLE_SCREENS),
    ...(offers('custom-games')
      ? [
          {
            screen: SHARED_GAME_SCREEN.customGames,
            Screen: () => (
              <CustomGameScreen
                gameId={id}
                title={game.title}
                onBack={back}
                {...history}
              />
            ),
          },
        ]
      : []),
    ...(offers('matchmaking')
      ? [
          {
            screen: SHARED_GAME_SCREEN.matchmaking,
            Screen: () => (
              <MultiplayerScreen gameId={id} title={game.title} onBack={back} />
            ),
          },
        ]
      : []),
    ...(offers('history')
      ? [
          {
            screen: SHARED_GAME_SCREEN.history,
            Screen: () => <GameHistory gameId={id} onBack={back} />,
          },
        ]
      : []),
  ];
}

/** The platform's puzzle screens, for a game offering puzzles. */
const PUZZLE_SCREENS: readonly GameOwnScreen[] = [
  { screen: SHARED_GAME_SCREEN.puzzle, Screen: PuzzlePlayScreen },
  { screen: SHARED_GAME_SCREEN.puzzleStats, Screen: PuzzleStatsScreen },
  { screen: SHARED_GAME_SCREEN.puzzleReview, Screen: PuzzleReviewScreen },
];

const PUZZLE_CHOICES: readonly GameChoiceItem[] = [
  {
    screen: SHARED_GAME_SCREEN.puzzle,
    title: () => <Trans>Puzzle</Trans>,
    caption: () => <Trans>Solve rated puzzles and climb the ladder</Trans>,
  },
  {
    screen: SHARED_GAME_SCREEN.puzzleStats,
    title: () => <Trans>Puzzle stats</Trans>,
    caption: () => <Trans>Puzzle rating trend and game log</Trans>,
  },
];

function sharedChoices(game: GameClient, offers: Offers): GameChoiceItem[] {
  const name = game.title;
  return [
    ...(game.puzzles === undefined ? [] : PUZZLE_CHOICES),
    ...(offers('custom-games')
      ? [
          {
            screen: SHARED_GAME_SCREEN.customGames,
            title: () => <Trans>Custom games</Trans>,
            caption: () => (
              <Trans>Play a person, choose a bot, or watch two bots</Trans>
            ),
          },
        ]
      : []),
    ...(offers('matchmaking')
      ? [
          {
            screen: SHARED_GAME_SCREEN.matchmaking,
            title: () => <Trans>Find an opponent</Trans>,
            caption: () => <Trans>Meet another {name} player</Trans>,
          },
        ]
      : []),
    ...(offers('history')
      ? [
          {
            screen: SHARED_GAME_SCREEN.history,
            title: () => <Trans>History and stats</Trans>,
            caption: () => <Trans>Review your games, wins and draws</Trans>,
          },
        ]
      : []),
  ];
}

type GameChoiceItem = Omit<GameChoice, 'Screen'>;

/** Every choice the game offers, in the one order every game shares. */
function gameChoices(game: GameClient, offers: Offers): GameChoiceItem[] {
  return [
    ...(game.choices ?? []),
    ...sharedChoices(game, offers),
    ...(game.settings === undefined
      ? []
      : [
          {
            screen: SHARED_GAME_SCREEN.settings,
            title: () => <Trans>Settings</Trans>,
            caption: game.settings.caption,
          },
        ]),
  ];
}

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
            <p class="text textCaption">
              <Dynamic component={props.game.instructions} />
            </p>
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
  const rules = useTurnGames();
  const offers: Offers = (capability) =>
    rules.offers(props.game.shared.id, capability);
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
      <div class="box flex-1 min-h-0 self-stretch">
        <FadeSwitch stateKey={navigation.screen()}>
          <Dynamic component={shown()} />
        </FadeSwitch>
      </div>
    </GameFrame>
  );
}
