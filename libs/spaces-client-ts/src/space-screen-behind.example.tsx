import { fn } from 'storybook/test';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { SpaceHomeScreenView } from './space-home-screen-view';
import { StorySpaceFrame } from './space-screen-chrome-story.example';
import { GAMES } from './spaces-story.example';

/**
 * Story decorator: a sheet or confirm opens over the viewer's own space
 * screen, as it does in the app, so the story has a screen behind its
 * overlay. The host's by default; a guest's story sets
 * `parameters: { spaceBehind: 'guest' }` and sees what a guest sees.
 */
export const withSpaceScreenBehind = createJSXDecorator((Story, context) => (
  <>
    <StorySpaceFrame>
      <SpaceHomeScreenView
        games={GAMES}
        canSelectGame={context.parameters['spaceBehind'] !== 'guest'}
        onSelectGame={fn()}
      />
    </StorySpaceFrame>
    <Story />
  </>
));
