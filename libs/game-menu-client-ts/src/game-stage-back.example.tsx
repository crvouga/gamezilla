import { CustomGameBack } from '@libs/game-session-client-ts/custom-game-back';
import {
  boardArgs,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { playCustomGameChoice } from '@libs/game-session-shared-ts/custom-game-play';
import {
  type CustomGame,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { GameScreenHistory } from '@libs/spaces-client-ts/game-screen-history';
import { SpaceScreenChromeValueProvider } from '@libs/spaces-client-ts/space-screen-chrome';
import { STORY_SPACE_CHROME } from '@libs/spaces-client-ts/space-screen-chrome-story.example';
import { SpaceScreenFrame } from '@libs/spaces-client-ts/space-screen-frame';
import {
  SpacesNavProvider,
  useSpacesNavBack,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { AVERY, JORDAN } from '@libs/spaces-client-ts/spaces-story.example';
import type { RegisteredGame } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  createTurnGames,
  TWO_PLAYER_SIDES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import { createSignal, merge, Show, untrack } from 'solid-js';
import { fn } from 'storybook/test';
import type { GameClientPresentation } from './game-client';
import { GameHomeScreenView } from './game-home-screen-view';

type BoardStory = {
  readonly game: RegisteredGame;
  readonly title: string;
  readonly caption: string;
  readonly tile: GameTileMotif;
  readonly presentation: GameClientPresentation;
};

const choices = (title: string) => [
  {
    screen: 'multiplayer',
    title: 'Find an opponent',
    caption: `Meet another ${title} player`,
  },
  {
    screen: 'custom-game',
    title: 'Play with friends',
    caption: 'With the people in this space, or bots',
  },
  {
    screen: 'history',
    title: 'History and stats',
    caption: 'Review your games, wins and draws',
  },
];

function useRound(gameType: RegisteredGame) {
  const rules = createTurnGames([gameType]);
  const opening = gameType.rules.initial();
  const [game, setGame] = createSignal<CustomGame>({
    ...newCustomGame('friday-round', AVERY.id, opening),
    black: { kind: 'person', person: JORDAN.id },
    ready: ['white', 'black'],
    status: 'active',
  });
  function choose(input: CustomGameInput) {
    const current = game();
    const next = playCustomGameChoice(
      current,
      { ...input, gameId: current.id, revision: current.revision },
      { actor: AVERY.id, now: 1000 + current.moves.length },
      rules
    );
    if (next === null || next === current)
      throw new Error('Game refused the choice');
    setGame(next);
  }
  const board = merge(boardArgs(opening), {
    get position() {
      return game().fen;
    },
    get interactive() {
      return game().turn === 'white' && game().status === 'active';
    },
    onAction: (uci: string) =>
      choose({ operation: 'move', uci, ply: game().moves.length }),
  });
  const table = {
    get turn() {
      return game().turn;
    },
    get moves() {
      return game().moves.map((move) => move.san);
    },
  };
  const resign = () => {
    choose({ operation: 'resign' });
    return Promise.resolve();
  };
  return { game, resign, board, table };
}

function SpaceJourney(props: BoardStory) {
  const back = useSpacesNavBack();
  const game = untrack(() => props.game);
  const round = useRound(game);
  const history = new GameScreenHistory();
  const room = STORY_SPACE_CHROME.spaceId;
  const [place, setPlace] = createSignal('choices');
  const show = (next: string) => {
    history.visit(room, game.rules.id, next);
    setPlace(next);
  };
  history.visit(room, game.rules.id, 'choices');
  const chrome = {
    ...STORY_SPACE_CHROME,
    get title() {
      return props.title;
    },
    get backLabel() {
      return `Back to ${props.title}`;
    },
    onBack: () => back()?.(),
    testIds: { ...STORY_SPACE_CHROME.testIds, back: 'nav-back' },
  };
  return (
    <SpaceScreenChromeValueProvider value={chrome}>
      <SpaceScreenFrame>
        <Show
          when={place() === 'custom-game'}
          fallback={
            <GameHomeScreenView
              title={chrome.title}
              tile={props.tile}
              subtitle={props.caption}
              choices={choices(props.title)}
              place={{ screen: 'home' }}
              onChoose={show}
              onOpen={fn()}
            />
          }
        >
          <CustomGameBack
            game={round.game()}
            canResign={round.game().status === 'active'}
            backWithinGame={() => false}
            leave={() => show(history.back(room, game.rules.id, place()))}
            resign={round.resign}
          />
          {renderGameTable(props.presentation, TWO_PLAYER_SIDES, round.board, {
            parameters: { table: round.table },
          })}
        </Show>
      </SpaceScreenFrame>
    </SpaceScreenChromeValueProvider>
  );
}

export function GameStageBackStory(props: BoardStory) {
  return (
    <SpacesNavProvider>
      <SpaceJourney {...props} />
    </SpacesNavProvider>
  );
}
