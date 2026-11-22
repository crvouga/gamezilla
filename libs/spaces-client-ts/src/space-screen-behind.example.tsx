import { fn } from 'storybook/test';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { SpaceGamesScreenView } from './space-games-screen-view';
import { StorySpaceFrame } from './space-screen-chrome-story.example';
import { GAMES } from './spaces-story.example';

/**
 * Story decorator: a sheet or confirm opens over the host's space screen,
 * as it does in the app, so the story has a screen behind its overlay.
 */
export const withSpaceScreenBehind = createJSXDecorator((Story) => (
  <>
    <StorySpaceFrame>
      <SpaceGamesScreenView
        games={GAMES}
        shownGame={null}
        canSelectGame
        hostChoosesNotice={false}
        onSelectGame={fn()}
      />
    </StorySpaceFrame>
    <Story />
  </>
));
