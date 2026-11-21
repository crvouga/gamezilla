import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import type { SpaceDetailScreenViewProps } from './space-detail-screen-view';
import { SpaceDetailScreenView } from './space-detail-screen-view';
import { SpaceMembersSheetView } from './space-members-sheet-view';
import { SpacePresenceStripView } from './space-presence-strip-view';
import { SpaceShareSheetView } from './space-share-sheet-view';
import { GameAreaExample } from './space-story-game-area.example';
import {
  AVERY,
  faces,
  GUESTS,
  HOSTED_SPACE,
  JORDAN,
  MEMBERS,
  ROBIN,
} from './spaces-story.example';

type Slots = {
  readonly body?: () => JSX.Element;
  readonly notice?: () => JSX.Element;
  readonly overlays?: () => JSX.Element;
};

/**
 * The body while the space chooses its game: a slot, since the game choice
 * draws its own space shell (`Screens/Spaces/Games`).
 */
function gamesList(): JSX.Element {
  return <GameAreaExample title="Choosing a game" />;
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
    spaceId: HOSTED_SPACE.spaceId,
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
  render: (args) => withSlots(args, { body: () => gamesList() }),
} satisfies Meta<typeof SpaceDetailScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The host in their space, choosing what to play. The bar reads the same on
 * every size: where you are (the room, with its own tile beside the
 * sidebar), then at the far edge the members, Minimize (the space goes on in
 * the miniplayer) and ⋯ with Share and Rename, then, after a divider and in
 * red, Leave and End space, each behind a confirm. Wide shows everyone's
 * faces; on a phone the members button is the people glyph with how many
 * are here. The body is the game choice, which draws its own space shell
 * (`Screens/Spaces/Games`).
 */
export const HostChoosingGame: Story = {};

/** First load, or the host not known yet: chrome stays, the body loads. */
export const Loading: Story = {
  args: { status: 'loading', title: 'Space' },
  render: (args) => withSlots(args, {}),
};

/** A guest: ⋯ holds Leave and no End, no Rename. */
export const Guest: Story = {
  args: { canRename: false, canEnd: false },
  render: (args) => withSlots(args, { body: () => gamesList() }),
};

/**
 * A game's own menu: the trail reads "Friday game night › Connect Four", and the
 * room is the one way back (to the space's games), so moving within the
 * room never reads like leaving it. A phone shows ‹ (named for the room)
 * with the room's name small over the game's. The game area is a slot.
 */
export const GameInProgress: Story = {
  args: {
    onPressBack: fn(),
    backLabel: 'Games',
    place: 'Connect Four',
  },
  render: (args) =>
    withSlots(args, {
      body: () => <GameAreaExample title="A game in progress" />,
    }),
};

/**
 * A screen a game's choices open (custom setup, finding an opponent, a
 * board, puzzles): the trail reads "Friday game night › Connect Four", and
 * the game is the way back to its own menu, whose way back is the room.
 */
export const InsideAGame: Story = {
  args: {
    onPressBack: fn(),
    backLabel: 'Connect Four',
    place: 'Connect Four',
  },
  render: (args) =>
    withSlots(args, {
      body: () => <GameAreaExample title="Connect Four" />,
    }),
};

/** Alone in the space: header and body both show only the host. */
export const NobodyElse: Story = {
  args: {
    presence: (size: number, compact: boolean) => (
      <SpacePresenceStripView
        faces={faces([AVERY])}
        size={size}
        compact={compact}
      />
    ),
  },
  render: (args) => withSlots(args, { body: () => gamesList() }),
  // regression: space-detail-fixture-roster-disagrees
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.findByText('Choosing a game')).resolves.toBeTruthy();
    for (const guest of GUESTS)
      await expect(canvas.queryByText(guest.name)).toBeNull();
  },
};

/** A guest whose host went offline: the bar says so; the body stays. */
export const HostOffline: Story = {
  args: { hostOffline: true, canRename: false, canEnd: false },
  render: (args) => withSlots(args, { body: () => gamesList() }),
};

/** A refused change in this space is told under the bar. */
export const WithRefusedChange: Story = {
  render: (args) =>
    withSlots(args, {
      body: () => gamesList(),
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
  args: {
    presence: (size: number, compact: boolean) => (
      <SpacePresenceStripView faces={MEMBERS} size={size} compact={compact} />
    ),
  },
  render: (args) =>
    withSlots(args, {
      body: () => gamesList(),
      overlays: () => (
        <SpaceMembersSheetView visible onClose={fn()} members={MEMBERS} />
      ),
    }),
  // regression: space-detail-fixture-roster-disagrees
  play: async ({ canvasElement }) => {
    const sheet = within(canvasElement.ownerDocument.body);
    for (const member of MEMBERS)
      await expect(
        sheet.findByTestId(Handles.spaceMemberRow(member.actor.id))
      ).resolves.toBeTruthy();
    await expect(
      sheet.queryByTestId(Handles.spaceMemberRow(ROBIN.id))
    ).toBeNull();
  },
};

/** The share sheet open as a guest: copy the link, see who has access. */
export const ShareOpen: Story = {
  args: { canRename: false, canEnd: false },
  render: (args) =>
    withSlots(args, {
      body: () => gamesList(),
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

/**
 * Minimize steps out of the space screen (the space keeps running in the
 * miniplayer); it may sit in ⋯ on a short row. The id stays `close-space`
 * so its baselines keep their paths.
 */
export const CloseSpace: Story = {
  name: 'Minimize space',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    if (canvas.queryByTestId(Handles.spaceClose) === null) {
      await userEvent.click(
        await canvas.findByTestId(Handles.spaceChromeOverflow)
      );
    }
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByTestId(
        Handles.spaceClose
      )
    );
    await expect(args.onPressHome).toHaveBeenCalled();
  },
};
