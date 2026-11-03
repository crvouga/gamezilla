import { fn } from 'storybook/test';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { SpaceDetailScreenView } from './space-detail-screen-view';
import { SpaceGamesScreenView } from './space-games-screen-view';
import { SpacePresenceStripView } from './space-presence-strip-view';
import { AVERY, faces, GAMES, GUESTS } from './spaces-story.example';

/**
 * Story decorator: a sheet or confirm opens over the host's space screen,
 * as it does in the app, so the story has a screen behind its overlay.
 */
export const withSpaceScreenBehind = createJSXDecorator((Story) => (
  <SpaceDetailScreenView
    title="Friday game night"
    status="ready"
    hostOffline={false}
    canRename
    canEnd
    presence={(size) => (
      <SpacePresenceStripView faces={faces([AVERY, ...GUESTS])} size={size} />
    )}
    overlays={<Story />}
    onPressHome={fn()}
    onPressBack={null}
    onPressMembers={fn()}
    onPressShare={fn()}
    onPressRename={fn()}
    onPressEnd={fn()}
    onPressLeave={fn()}
  >
    <SpaceGamesScreenView
      games={GAMES}
      shownGame={null}
      canSelectGame
      hostChoosesNotice={false}
      onSelectGame={fn()}
    />
  </SpaceDetailScreenView>
));
