import { withChessBoardContext } from '@libs/chess-root-client-ts/chess-board-story.example';
import { StoryGameCatalog } from '@libs/game-menu-client-ts/game-menu-catalog.example';
import { GAME_DEFINITIONS } from '@libs/games-shared-ts/game-plugins';
import {
  createJSXDecorator,
  type Loader,
  type Preview,
} from 'storybook-solidjs-vite';

// The menu accepts any game's lesson. Storybook supplies the registered games
// at composition time, just as the app does, and only for stories that use them.
export const argTypesEnhancers: Preview['argTypesEnhancers'] = [
  ({ argTypes, parameters }) => {
    const gameId = argTypes['gameId'];
    if (!parameters['catalogLesson'] || !gameId) return argTypes;
    return {
      ...argTypes,
      gameId: { ...gameId, options: GAME_DEFINITIONS.map((game) => game.id) },
    };
  },
];

export const argsEnhancers: Preview['argsEnhancers'] = [
  ({ argTypes, parameters }) =>
    parameters['catalogLesson'] && argTypes['gameId']
      ? { gameId: 'quoridor' }
      : {},
];

export const loaders: Loader[] = [
  async ({ parameters }) => {
    if (!parameters['catalogLesson']) return {};
    const { GAME_CLIENT_DEFINITIONS } = await import('./game-plugins.client');
    return { catalogGames: new StoryGameCatalog(GAME_CLIENT_DEFINITIONS) };
  },
];

export const decorators = [
  createJSXDecorator((Story, context) =>
    context.parameters['catalogLesson'] ? (
      withChessBoardContext(Story, context)
    ) : (
      <Story />
    )
  ),
];
