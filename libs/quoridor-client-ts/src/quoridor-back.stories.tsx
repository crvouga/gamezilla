import { GameStageBackStory } from '@libs/game-menu-client-ts/game-stage-back.example';
import { quoridorGameShared } from '@libs/quoridor-shared-ts/quoridor-game';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { quoridorGameClient } from './quoridor-game-client';

function BackFromBoard() {
  return (
    <GameStageBackStory
      game={quoridorGameShared.registration}
      title={quoridorGameClient.title}
      caption={quoridorGameClient.caption}
      tile={quoridorGameClient.motif}
      presentation={quoridorGameClient.presentation}
    />
  );
}

const meta = {
  id: 'screens-games-quoridor-stage-back',
  title: 'Screens/Space/Boards/Quoridor/Stage Back',
  component: BackFromBoard,
  parameters: {
    appRouter: true,
    storyRoute: {
      pathname: '/space/story-room',
      tab: false,
      spaceBody: 'story',
    },
  },
} satisfies Meta<typeof BackFromBoard>;
export default meta;
export const Playing: StoryObj<typeof meta> = {};
