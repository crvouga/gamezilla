import { fn } from 'storybook/test';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { SpaceGameChoiceView } from './space-game-choice-view';
import { STORY_GAME_FAMILIES, storyChrome } from './spaces-story.example';

/**
 * Story decorator: a sheet or confirm opens over the host's space screen,
 * as it does in the app, so the story has a screen behind its overlay.
 */
export const withSpaceScreenBehind = createJSXDecorator((Story) => (
  <>
    <SpaceGameChoiceView
      chrome={storyChrome('host')}
      families={STORY_GAME_FAMILIES}
      canChoose
      onChoose={fn()}
    />
    <Story />
  </>
));
