import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RemoveSpacePersonModalView } from './remove-space-person-modal-view';
import { withSpaceScreenBehind } from './space-screen-behind.example';
import type { SpaceAddition } from './space-share-add-people-view';
import { SpaceShareAddPeopleView } from './space-share-add-people-view';
import type { SpaceShareSheetViewProps } from './space-share-sheet-view';
import { SpaceShareSheetView } from './space-share-sheet-view';
import { AVERY, JORDAN, MORGAN, PLAYBOT } from './spaces-story.example';

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
      onPick={fn()}
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
  title: 'Screens/Spaces/Share space',
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
  args: { canManage: false },
  render: (args) => withSlots(args, {}),
};

/** People with access are still being read. */
export const Loading: Story = {
  args: { peopleStatus: 'loading', people: [] },
};

/** Nobody added yet: the list points at the link. */
export const Empty: Story = { args: { people: [] } };

/** An addition went through: who was added and what they do next. */
export const Added: Story = {
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
          message: 'This space is full. Remove someone first.',
        }),
    }),
};

/** The host may not search people: the denial stands in for results. */
export const SearchDenied: Story = {
  render: (args) =>
    withSlots(args, {
      addPeople: () =>
        addPeople({ status: 'idle' }, () => (
          <EmptyState
            variant="compact"
            icon={KeyRoundIcon}
            title="Sign in to find people"
            body="Searching people needs an account."
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
