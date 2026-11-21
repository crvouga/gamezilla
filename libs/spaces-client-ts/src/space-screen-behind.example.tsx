import { fn } from 'storybook/test';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { SpaceGameChoiceView } from './space-game-choice-view';
import { StorySpaceFrame } from './space-screen-chrome-story.example';
import { STORY_GAME_FAMILIES, storyChrome } from './spaces-story.example';

/**
 * Story decorator: a sheet or confirm opens over the host's space screen,
 * as it does in the app, so the story has a screen behind its overlay.
 */
export const withSpaceScreenBehind = createJSXDecorator((Story) => (
  <>
    <StorySpaceFrame>
      <SpaceGameChoiceView
        chrome={storyChrome('host')}
        families={STORY_GAME_FAMILIES}
        canChoose
        onChoose={fn()}
      />
    </StorySpaceFrame>
    <Story />
  </>
));
