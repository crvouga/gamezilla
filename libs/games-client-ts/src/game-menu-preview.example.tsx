import { withChessBoardContext } from '@libs/chess-root-client-ts/chess-board-story.example';
import { createJSXDecorator, type Loader } from 'storybook-solidjs-vite';

// The menu accepts any game's lesson. Storybook supplies the registered games
// at composition time, just as the app does, and only for stories that use them.
export const loaders: Loader[] = [
  async ({ parameters }) => {
    if (!parameters['catalogLesson']) return {};
    const { GAME_CLIENT_DEFINITIONS } = await import('./game-plugins.client');
    return { catalogGames: GAME_CLIENT_DEFINITIONS };
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
