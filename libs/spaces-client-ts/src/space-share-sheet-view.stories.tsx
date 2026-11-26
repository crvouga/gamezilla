import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { useRemoveSpacePersonStep } from './remove-space-person-step';
import type { SharingExampleProps } from './space-management.example';
import { SharingExample } from './space-management.example';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import type { SpaceAddition } from './space-share-add-people-view';
import { SpaceShareAddPeopleView } from './space-share-add-people-view';
import { SpaceSharingPanel } from './space-sharing-panel';
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
  args: SharingExampleProps,
  slots: {
    readonly addPeople?: () => JSX.Element;
  }
): JSX.Element {
  return <SharingExample {...args} addPeople={slots.addPeople?.()} />;
}

/** The sheet asking to remove jordan in its own dialog. */
function RemovingJordan(props: {
  readonly args: SharingExampleProps;
}): JSX.Element {
  const removal = useRemoveSpacePersonStep({
    name: JORDAN.name,
    onClose: fn(),
    operation: fn(() => Promise.resolve()),
  });
  return (
    <SharingExample
      {...props.args}
      addPeople={addPeople({ status: 'idle' })}
      removal={removal}
    />
  );
}

const meta = {
  id: 'screens-spaces-share',
  title: 'Screens/Space/Manage/Share',
  component: SpaceSharingPanel,
  tags: ['autodocs'],
  decorators: [withSpaceScreenBehind],
  parameters: {
    appRouter: true,
    controls: { exclude: ['people', 'addPeople', 'removal'] },
  },
  args: {
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
} satisfies Meta<SharingExampleProps>;
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
    const sheet = await body.findByRole('dialog', {
      name: 'People in this space',
    });
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
  // regression: space-share-toast-covers-close
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const toast = await body.findByRole('region', { name: 'Alerts' });
    const close = await body.findByTestId(Handles.spaceShareClose);
    const alertBox = toast.getBoundingClientRect();
    const closeBox = close.getBoundingClientRect();
    await expect(
      alertBox.top >= closeBox.bottom ||
        alertBox.bottom <= closeBox.top ||
        alertBox.left >= closeBox.right ||
        alertBox.right <= closeBox.left
    ).toBe(true);
  },
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

/** Remove asks first, in the Share dialog itself: one title, one close. */
export const RemoveConfirm: Story = {
  render: (args) => <RemovingJordan args={args} />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: 'Remove person?' });
    await expect(
      within(dialog).getByTestId(Handles.spaceRemoveConfirm)
    ).toBeVisible();
    await expect(
      body.queryByRole('dialog', { name: 'People in this space' })
    ).toBeNull();
  },
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
