import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RemoveSpacePersonModalView } from './remove-space-person-modal-view';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import type { SpaceAddition } from './space-share-add-people-view';
import { SpaceShareAddPeopleView } from './space-share-add-people-view';
import type { SpaceShareSheetViewProps } from './space-share-sheet-view';
import { SpaceShareSheetView } from './space-share-sheet-view';
import { AVERY, JORDAN, MORGAN, PLAYBOT } from './spaces-story.example';

/** The add-people search's pick, spied on so a story can see the add. */
const onPickPerson = fn();

function addPeople(
  addition: SpaceAddition,
  denied?: () => JSX.Element
): JSX.Element {
  return (
    <SpaceShareAddPeopleView
      query=""
      onQueryChange={fn()}
      candidates={[{ ...MORGAN, searchText: MORGAN.name }]}
      searching={false}
      addition={addition}
      searchDenied={denied?.()}
      onPick={onPickPerson}
      onRetry={fn()}
    />
  );
}

/** Slots are built at render time, inside the story's providers. */
function withSlots(
  args: SpaceShareSheetViewProps,
  slots: {
    readonly addPeople?: () => JSX.Element;
    readonly overlay?: () => JSX.Element;
  }
): JSX.Element {
  return (
    <SpaceShareSheetView
      {...args}
      addPeople={slots.addPeople?.()}
      overlay={slots.overlay?.()}
    />
  );
}

const meta = {
  id: 'screens-spaces-share',
  title: 'Screens/Space/Manage/Share',
  component: SpaceShareSheetView,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: {
    appRouter: true,
    controls: { exclude: ['people', 'addPeople', 'overlay'] },
  },
  args: {
    open: true,
    onClose: fn(),
    onCopyLink: fn(() => Promise.resolve()),
    canManage: true,
    peopleStatus: 'ready',
    people: [AVERY, JORDAN, PLAYBOT],
    hostId: AVERY.id,
    // The story's viewer is avery, the host: their row reads "You".
    viewerId: AVERY.id,
    onRemovePerson: fn(),
  },
  render: (args) =>
    withSlots(args, { addPeople: () => addPeople({ status: 'idle' }) }),
} satisfies Meta<typeof SpaceShareSheetView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host: copy the link, add people, remove anyone but themself. */
export const Host: Story = {};

/** A guest: the link and who has access, nothing to manage. */
export const Guest: Story = {
  args: { canManage: false, viewerId: JORDAN.id },
  parameters: { spaceBehind: 'guest' },
  render: (args) => withSlots(args, {}),
};

/** J5 as a guest: Copy link copies the space's link and says it did. */
export const GuestCopiesLink: Story = {
  args: { canManage: false, viewerId: JORDAN.id },
  parameters: { spaceBehind: 'guest' },
  render: (args) => withSlots(args, {}),
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const sheet = await body.findByRole('dialog', { name: 'Share space' });
    await userEvent.click(
      within(sheet).getByRole('button', { name: 'Copy link' })
    );
    await expect(args.onCopyLink).toHaveBeenCalledTimes(1);
    await expect(
      await within(sheet).findByRole('button', { name: /Copied/ })
    ).toBeVisible();
  },
};

/** People with access are still being read. */
export const Loading: Story = {
  args: { peopleStatus: 'loading', people: [] },
};

/** Nobody added yet: the host's own row, and the list points at the link. */
export const Empty: Story = { args: { people: [AVERY] } };

/** An addition went through: who was added, now in the list, and what they do next. */
export const Added: Story = {
  args: { people: [AVERY, JORDAN, PLAYBOT, MORGAN] },
  render: (args) =>
    withSlots(args, {
      addPeople: () => addPeople({ status: 'success', name: 'morgan' }),
    }),
};

/** An addition was refused: why, with a safe retry. */
export const AddFailed: Story = {
  render: (args) =>
    withSlots(args, {
      addPeople: () =>
        addPeople({
          status: 'error',
          name: 'morgan',
          message:
            "Couldn't reach the server. Check your connection and try again.",
        }),
    }),
};

/** The host may not search people: the denial stands in for results. */
export const SearchDenied: Story = {
  render: (args) =>
    withSlots(args, {
      addPeople: () =>
        addPeople({ status: 'idle' }, () => (
          <DenialSurfaceView
            variant="compact"
            denial={{
              icon: KeyRoundIcon,
              title: 'Sign in to find people',
              body: 'Searching people needs an account. Copy the link to invite anyone now.',
              action: { label: 'Sign in', onPress: fn() },
              dataSet: {
                testid: 'permission-denial',
                reason: 'requires_account',
              },
            }}
          />
        )),
    }),
};

/** Remove asks first; the confirm sits over the sheet. */
export const RemoveConfirm: Story = {
  render: (args) =>
    withSlots(args, {
      addPeople: () => addPeople({ status: 'idle' }),
      overlay: () => (
        <RemoveSpacePersonModalView
          name={JORDAN.name}
          onClose={fn()}
          operation={fn(() => Promise.resolve())}
        />
      ),
    }),
};

/** Remove on a guest's row asks the host to confirm. */
export const PressRemove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(`space-remove-person-${JORDAN.id}`)
    );
    await expect(args.onRemovePerson).toHaveBeenCalledWith(JORDAN);
  },
};

/** J5: the host searches a friend and picks them; they are added. */
export const AddFriend: Story = {
  render: (args) =>
    withSlots(args, { addPeople: () => addPeople({ status: 'idle' }) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId(Handles.spaceAddTrigger));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await body.findByTestId(Handles.spaceAddPerson(MORGAN.id))
    );
    await expect(onPickPerson).toHaveBeenCalled();
  },
};
