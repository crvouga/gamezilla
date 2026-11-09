import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  ContentAttemptScreenView,
  type ContentAttemptScreenViewProps,
} from './content-attempt-screen-view';
import { StoryPackActions } from './content-attempt-story.example';
import {
  StoryAttemptControls,
  StoryCountingPlayer,
  StoryKeptCopies,
} from './content-story.example';

/** Renders the view with a fresh player, controls and kept positions. */
function render(args: ContentAttemptScreenViewProps) {
  return (
    <ContentAttemptScreenView
      {...args}
      player={
        <StoryCountingPlayer
          state={args.complete ? '7 of 7' : '3 of 7'}
          disabled={args.saving || args.rulesChanged}
        />
      }
      controls={<StoryAttemptControls disabled={args.saving} />}
      packActions={args.packActions}
      keptPositions={<StoryKeptCopies />}
    />
  );
}

const meta = {
  id: 'screens-puzzles-content-attempt',
  title: 'Screens/Puzzles/Content attempt',
  component: ContentAttemptScreenView,
  tags: ['autodocs'],
  render,
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['denial', 'attempt', 'player', 'controls', 'keptPositions'],
    },
  },
  args: {
    status: 'ready',
    attempt: {
      id: 'a77e0000-0000-4000-8000-000000000001',
      sourceId: '7c1e0a00-0000-4000-8000-000000000001',
      packRevisionId: null,
      title: 'Count to seven',
      difficulty: 'Easy',
      description: 'Reach seven exactly, one or two steps at a time.',
    },
    playtest: false,
    saving: false,
    changeError: null,
    complete: false,
    rulesChanged: false,
    unopenable: false,
    onRetryChange: fn(),
    onReturnToLibrary: fn(),
  },
} satisfies Meta<typeof ContentAttemptScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Partway through a published puzzle, progress saved on the device. */
export const InProgress: Story = {};

/** A move is being saved; the board and controls wait for it. */
export const Saving: Story = { args: { saving: true } };

/** A move was not saved; the earlier position is kept and retry is offered. */
export const ChangeFailed: Story = {
  args: {
    changeError:
      'The change was not saved. Your previous position is still kept. Try again.',
  },
};

/** The puzzle is solved: the completion is saved. */
export const Completed: Story = { args: { complete: true } };

/** A private playtest of the person's draft: it counts toward nothing. */
export const Playtest: Story = { args: { playtest: true } };

/** A solved playtest sends the author back to validate and publish. */
export const PlaytestSolved: Story = {
  args: { playtest: true, complete: true },
};

/** Published under rules this app version lacks: the attempt waits, kept. */
export const RulesChanged: Story = { args: { rulesChanged: true } };

/** The saved position cannot be opened: choose another or restart. */
export const Unopenable: Story = { args: { unopenable: true } };

/** What the attempt plays has not reached this device. */
export const Missing: Story = { args: { status: 'missing' } };

/** Someone else's attempt: the denial replaces the board. */
export const Denied: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'This attempt belongs to someone else',
      dataSet: { testid: 'permission-denial', reason: 'not_granted' },
    },
  },
};

/** Retrying a failed move asks to save it again. */
export const RetryChange: Story = {
  args: {
    changeError:
      'The change was not saved. Your previous position is still kept. Try again.',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: /retry/i })
    );
    await expect(args.onRetryChange).toHaveBeenCalled();
  },
};

const PACK = { title: 'Counting basics', position: 2, total: 4 };

/** A pack puzzle partway: its way on (the overview) sits in the pack card. */
export const PackInProgress: Story = {
  args: { pack: PACK },
  render: (args) => render({ ...args, packActions: <StoryPackActions /> }),
};

/** The same pack puzzle solved: its next puzzle joins the overview in the card. */
export const PackCompleted: Story = {
  args: { pack: PACK, complete: true },
  render: (args) =>
    render({
      ...args,
      packActions: (
        <StoryPackActions next={{ title: 'Count to nine', open: fn() }} />
      ),
    }),
};
