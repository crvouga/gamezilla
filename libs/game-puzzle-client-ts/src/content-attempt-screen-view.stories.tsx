import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  ContentAttemptScreenView,
  type ContentAttemptScreenViewProps,
} from './content-attempt-screen-view';
import {
  ATTEMPT_STORY_ARGS,
  ATTEMPT_STORY_PARAMETERS,
} from './content-attempt-story.example';
import {
  StoryAttemptControls,
  StoryCountingPlayer,
} from './content-story.example';

/** Renders the stage with a fresh player and commands. */
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
    />
  );
}

const meta = {
  id: 'screens-puzzles-content-attempt',
  title: 'Screens/Puzzles/Content attempt',
  component: ContentAttemptScreenView,
  tags: ['autodocs'],
  render,
  parameters: ATTEMPT_STORY_PARAMETERS,
  args: ATTEMPT_STORY_ARGS,
} satisfies Meta<typeof ContentAttemptScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Partway through a published puzzle: the board, its commands, one way on. */
export const InProgress: Story = {};

/** A move is being saved; the board and its commands wait for it. */
export const Saving: Story = { args: { saving: true } };

/** A move was not saved; the earlier position is kept and retry is offered. */
export const ChangeFailed: Story = {
  args: {
    changeError:
      'The change was not saved. Your previous position is still kept. Try again.',
  },
};

/** The puzzle is solved: what comes next is the one filled command. */
export const Completed: Story = { args: { complete: true } };

/** A private playtest of the person's draft, on its board. */
export const Playtest: Story = { args: { playtest: true } };

/** A solved playtest: the way on leads back toward the builder. */
export const PlaytestSolved: Story = {
  args: { playtest: true, complete: true },
};

/** Published under rules this app version lacks: the attempt waits, kept. */
export const RulesChanged: Story = { args: { rulesChanged: true } };

/** The saved position cannot be opened: choose another or restart. */
export const Unopenable: Story = { args: { unopenable: true } };

/** The puzzle itself cannot be read: the way out is the library. */
export const Unreadable: Story = {
  args: { unopenable: true, unreadable: true },
};

/** The attempt asked for is still on its way. */
export const Loading: Story = { args: { status: 'loading' } };

/** What the attempt plays has not reached this device. */
export const Missing: Story = { args: { status: 'missing' } };

/** The attempt was removed: said plainly, with the way back. */
export const Gone: Story = { args: { status: 'gone' } };

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

/** A pack puzzle partway: the stage is the same; the pack is behind Progress. */
export const PackInProgress: Story = { args: { pack: PACK } };

/** The same pack puzzle solved: its way on is the filled command. */
export const PackCompleted: Story = { args: { pack: PACK, complete: true } };

/** The one control onward opens where the attempt stands. */
export const OpenProgress: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-open-progress'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'progress' });
  },
};
