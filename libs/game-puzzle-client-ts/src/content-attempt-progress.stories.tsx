import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  ContentAttemptScreenView,
  type ContentAttemptScreenViewProps,
} from './content-attempt-screen-view';
import {
  ATTEMPT_STORY_ARGS,
  ATTEMPT_STORY_PARAMETERS,
  StoryPackActions,
} from './content-attempt-story.example';
import { StoryKeptPositions } from './content-story.example';

/** Renders where the attempt stands with fresh kept positions. */
function render(args: ContentAttemptScreenViewProps) {
  return (
    <ContentAttemptScreenView
      {...args}
      wayOn={args.wayOn}
      keptPositions={<StoryKeptPositions />}
    />
  );
}

const meta = {
  id: 'screens-puzzles-content-attempt-progress',
  title: 'Screens/Puzzles/Content attempt/Progress',
  component: ContentAttemptScreenView,
  render,
  parameters: ATTEMPT_STORY_PARAMETERS,
  args: {
    ...ATTEMPT_STORY_ARGS,
    place: { screen: 'progress' },
    figures: [{ key: 'remaining', label: 'Steps left', value: '4' }],
  },
} satisfies Meta<typeof ContentAttemptScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Partway through a puzzle on its own: its figures, the save, its kept positions. */
export const InProgress: Story = {};

/** A move is still being saved. */
export const Saving: Story = { args: { saving: true } };

/** A move was not saved: the retry is offered here too. */
export const ChangeFailed: Story = {
  args: {
    changeError:
      'The change was not saved. Your previous position is still kept. Try again.',
  },
};

/** The puzzle is solved: the completion is saved. */
export const Completed: Story = { args: { complete: true } };

/** Solved before, then played away from solved: said quietly. */
export const SolvedBefore: Story = { args: { solvedBefore: true } };

/** A private playtest: it counts toward nothing, and leads back to its builder. */
export const Playtest: Story = {
  args: { playtest: true },
  render: (args) =>
    render({
      ...args,
      wayOn: <StoryPackActions overview="Return to builder" />,
    }),
};

/** A solved playtest sends the author back to validate and publish. */
export const PlaytestSolved: Story = {
  ...Playtest,
  args: { playtest: true, complete: true },
};

const PACK = { title: 'Counting basics', position: 2, total: 4 };

/** A pack puzzle partway: its place in the pack and the pack's overview. */
export const PackInProgress: Story = {
  args: { pack: PACK },
  render: (args) => render({ ...args, wayOn: <StoryPackActions /> }),
};

/** The same pack puzzle solved: its next puzzle is the filled command. */
export const PackCompleted: Story = {
  args: { pack: PACK, complete: true },
  render: (args) =>
    render({
      ...args,
      wayOn: <StoryPackActions next={{ title: 'Count to nine', open: fn() }} />,
    }),
};

/** Published under rules this app version lacks: said here too. */
export const RulesChanged: Story = { args: { rulesChanged: true } };

/** Retrying a failed move asks to save it again. */
export const RetryChange: Story = {
  ...ChangeFailed,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: /retry/i })
    );
    await expect(args.onRetryChange).toHaveBeenCalled();
  },
};
