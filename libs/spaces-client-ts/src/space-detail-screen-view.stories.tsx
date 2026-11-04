import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import type { SpaceDetailScreenViewProps } from './space-detail-screen-view';
import { SpaceDetailScreenView } from './space-detail-screen-view';
import { SpaceGamesScreenView } from './space-games-screen-view';
import { SpaceMembersSheetView } from './space-members-sheet-view';
import { SpacePresenceStripView } from './space-presence-strip-view';
import { SpaceShareSheetView } from './space-share-sheet-view';
import { GameAreaExample } from './space-story-game-area.example';
import {
  AVERY,
  faces,
  GAMES,
  GUESTS,
  JORDAN,
  MEMBERS,
} from './spaces-story.example';

type Slots = {
  readonly body?: () => JSX.Element;
  readonly notice?: () => JSX.Element;
  readonly overlays?: () => JSX.Element;
};

function gamesList(canSelectGame: boolean): JSX.Element {
  return (
    <SpaceGamesScreenView
      games={GAMES}
      shownGame={null}
      canSelectGame={canSelectGame}
      present={1 + GUESTS.length}
      hostChoosesNotice={false}
      onSelectGame={fn()}
    />
  );
}

/** Slots are built at render time, inside the story's providers. */
function withSlots(
  args: SpaceDetailScreenViewProps,
  slots: Slots
): JSX.Element {
  return (
    <SpaceDetailScreenView
      {...args}
      notice={slots.notice?.()}
      overlays={slots.overlays?.()}
    >
      {slots.body?.()}
    </SpaceDetailScreenView>
  );
}

const meta = {
  id: 'screens-spaces-detail',
  title: 'Screens/Spaces/Space',
  component: SpaceDetailScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['presence', 'notice', 'overlays', 'children'],
    },
  },
  args: {
    title: 'Friday game night',
    status: 'ready',
    hostOffline: false,
    canRename: true,
    canEnd: true,
    presence: (size: number, compact: boolean) => (
      <SpacePresenceStripView
        faces={faces([AVERY, ...GUESTS])}
        size={size}
        compact={compact}
      />
    ),
    onPressHome: fn(),
    onPressBack: null,
    onPressMembers: fn(),
    onPressShare: fn(),
    onPressRename: fn(),
    onPressEnd: fn(),
    onPressLeave: fn(),
  },
  render: (args) => withSlots(args, { body: () => gamesList(true) }),
} satisfies Meta<typeof SpaceDetailScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The host in their space: every action, choosing what to play. Wide, the
 * members button is everyone's faces; on a phone it is the people glyph
 * with how many are here, one button wide, so it stays beside the title.
 */
export const HostChoosingGame: Story = {};

/** First load, or the host not known yet: chrome stays, the body loads. */
export const Loading: Story = {
  args: { status: 'loading', title: 'Space' },
  render: (args) => withSlots(args, {}),
};

/** A guest: Leave instead of End, no Rename, the list says the host picks. */
export const Guest: Story = {
  args: { canRename: false, canEnd: false },
  render: (args) => withSlots(args, { body: () => gamesList(false) }),
};

/** A game in progress: Back returns to its menu; the game area is a slot. */
export const GameInProgress: Story = {
  args: { onPressBack: fn() },
  render: (args) =>
    withSlots(args, {
      body: () => <GameAreaExample title="A game in progress" />,
    }),
};

/** Alone in the space: the members button shows the people glyph. */
export const NobodyElse: Story = {
  args: {
    presence: (size: number) => (
      <SpacePresenceStripView faces={[]} size={size} />
    ),
  },
};

/** A guest whose host went offline: the bar says so; the body stays. */
export const HostOffline: Story = {
  args: { hostOffline: true, canRename: false, canEnd: false },
  render: (args) => withSlots(args, { body: () => gamesList(false) }),
};

/** A refused change in this space is told under the bar. */
export const WithRefusedChange: Story = {
  render: (args) =>
    withSlots(args, {
      body: () => gamesList(true),
      notice: () => (
        <Notice tone="error">Your space couldn't be renamed. Try again.</Notice>
      ),
    }),
};

/** Long titles truncate in the bar instead of pushing the actions off. */
export const LongTitle: Story = {
  args: {
    title:
      'The extremely long and very descriptive name of a space about board games',
  },
};

/** The members sheet open over the space. */
export const MembersOpen: Story = {
  render: (args) =>
    withSlots(args, {
      body: () => gamesList(true),
      overlays: () => (
        <SpaceMembersSheetView visible onClose={fn()} members={MEMBERS} />
      ),
    }),
};

/** The share sheet open as a guest: copy the link, see who has access. */
export const ShareOpen: Story = {
  args: { canRename: false, canEnd: false },
  render: (args) =>
    withSlots(args, {
      body: () => gamesList(false),
      overlays: () => (
        <SpaceShareSheetView
          open
          onClose={fn()}
          onCopyLink={fn(() => Promise.resolve())}
          canManage={false}
          peopleStatus="ready"
          people={[AVERY, JORDAN]}
          hostId={AVERY.id}
          onRemovePerson={fn()}
        />
      ),
    }),
};

/** Close leaves the space screen (the space keeps running in the miniplayer). */
export const CloseSpace: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.spaceClose));
    await expect(args.onPressHome).toHaveBeenCalled();
  },
};
