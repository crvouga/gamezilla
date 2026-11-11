import { useArgs } from 'storybook/preview-api';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CatalogueLoadScreenView } from './catalogue-load-screen-view';
import {
  STORY_LOAD_ARGS,
  STORY_LOAD_JOB,
  STORY_SOURCE_MISSING,
  STORY_SOURCE_SAVED,
} from './catalogue-load-story.example';

const meta = {
  id: 'screens-puzzles-catalogue-load-load',
  title: 'Screens/Puzzles/Catalogue load/Load',
  component: CatalogueLoadScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['frame', 'copy', 'place', 'denial', 'job', 'source'],
    },
  },
  args: STORY_LOAD_ARGS,
} satisfies Meta<typeof CatalogueLoadScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The file is saved and nothing is loading: the one command starts a load. */
export const ReadyToLoad: Story = {};

/** The load's status has not answered yet: starting waits for it. */
export const Connecting: Story = { args: { link: 'connecting' } };

/** The shared file is being checked: its row says so, and starting waits. */
export const CheckingSource: Story = {
  args: { source: { ...STORY_SOURCE_SAVED, status: 'checking' } },
};

/** The check failed and no file is known: the row says so; its place has the retry. */
export const SourceCheckFailed: Story = {
  args: {
    source: {
      ...STORY_SOURCE_MISSING,
      status: 'check-failed',
      checkError: 'The bucket could not be reached. Check again.',
    },
  },
};

/** No file is saved: starting says a file is needed first, and the row leads to it. */
export const SourceMissing: Story = {
  args: { pool: null, source: STORY_SOURCE_MISSING },
};

/** A load is adding puzzles: its progress, its figures and the one command stops it. */
export const Loading: Story = {
  args: { stage: 'loading', job: STORY_LOAD_JOB },
};

/** The latest load finished; another can start. */
export const Finished: Story = {
  args: {
    stage: 'finished',
    job: {
      ...STORY_LOAD_JOB,
      status: 'finished',
      progress: 1,
      processed: 3_812_000,
      finishedAt: '2023-11-14T22:12:00.000Z',
    },
  },
};

/** The latest load failed, with what went wrong; starting again is the retry. */
export const LoadFailed: Story = {
  args: {
    stage: 'failed',
    job: {
      ...STORY_LOAD_JOB,
      status: 'failed',
      error: 'Batch 14 could not be read: unexpected end of file.',
      finishedAt: '2023-11-14T22:12:00.000Z',
    },
  },
};

/** The latest load was stopped; what it added stays. */
export const Stopped: Story = {
  args: {
    stage: 'stopped',
    job: {
      ...STORY_LOAD_JOB,
      status: 'stopped',
      finishedAt: '2023-11-14T22:12:00.000Z',
    },
  },
};

/** Offline while a load runs: the last status shows; it cannot be stopped. */
export const Offline: Story = {
  args: { stage: 'loading', link: 'offline', job: STORY_LOAD_JOB },
};

/** Offline with nothing loading: the last status shows; nothing can start. */
export const OfflineReady: Story = { args: { link: 'offline' } };

/** Stopping a running load asks first, in a destructive confirm. */
export const ConfirmStop: Story = {
  args: { stage: 'loading', job: STORY_LOAD_JOB },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('puzzle-load-stop'));
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText('Stop loading puzzles?')).toBeVisible();
  },
};

/** The file's row opens its own place, where it is checked, chosen and saved. */
export const OpenSource: Story = {
  parameters: { test: { restoreMocks: false } },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <CatalogueLoadScreenView
        {...args}
        onOpen={(place) => {
          args.onOpen(place);
          updateArgs({ place });
        }}
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('puzzle-load-source'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'source' });
    await expect(
      await canvas.findByTestId('puzzle-source-saved')
    ).toBeVisible();
  },
};
