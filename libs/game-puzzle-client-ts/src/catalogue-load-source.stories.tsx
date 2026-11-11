import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CatalogueLoadScreenView } from './catalogue-load-screen-view';
import {
  STORY_LOAD_ARGS,
  STORY_SOURCE_CHOSEN,
  STORY_SOURCE_MISSING,
  STORY_SOURCE_SAVED,
  STORY_SOURCE_UPLOADING,
} from './catalogue-load-story.example';

const meta = {
  id: 'screens-puzzles-catalogue-load-source',
  title: 'Screens/Puzzles/Catalogue load/Source',
  component: CatalogueLoadScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['frame', 'copy', 'place', 'denial', 'job', 'source'],
    },
  },
  args: { ...STORY_LOAD_ARGS, place: { screen: 'source' } },
} satisfies Meta<typeof CatalogueLoadScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The shared file is saved: its name, and checking for it again. */
export const Saved: Story = {};

/** Checking the shared bucket; a file seen before stays named meanwhile. */
export const CheckingSource: Story = {
  args: { source: { ...STORY_SOURCE_SAVED, status: 'checking' } },
};

/** The first check has not finished: nothing is asked of the person yet. */
export const FirstCheck: Story = {
  args: { source: { ...STORY_SOURCE_MISSING, status: 'checking' } },
};

/** The check failed: why, and the retry. No other file is asked for. */
export const SourceCheckFailed: Story = {
  args: {
    source: {
      ...STORY_SOURCE_MISSING,
      status: 'check-failed',
      checkError: 'The bucket could not be reached. Check again.',
    },
  },
};

/** No file is saved yet: choose one to upload. Uploading waits for a choice. */
export const SourceMissing: Story = { args: { source: STORY_SOURCE_MISSING } };

/** A file is chosen and ready to upload. */
export const FileChosen: Story = { args: { source: STORY_SOURCE_CHOSEN } };

/** The file is uploading: how far it is, and the one way to stop it. */
export const Uploading: Story = {
  args: { stage: 'saving', source: STORY_SOURCE_UPLOADING },
};

/** The upload did not finish: why, with the chosen file kept for another try. */
export const SaveFailed: Story = {
  args: {
    source: {
      ...STORY_SOURCE_CHOSEN,
      saveError:
        'The Lichess file could not finish saving without a connection.',
    },
  },
};

/** Offline before any check: a connection is needed; a missing file is not assumed. */
export const Offline: Story = {
  args: {
    link: 'offline',
    pool: null,
    source: { ...STORY_SOURCE_MISSING, status: 'unknown' },
  },
};

/** Offline with a file seen before: it stays named; checking again waits. */
export const OfflineSaved: Story = { args: { link: 'offline' } };

/** Stopping an upload asks first, in a destructive confirm. */
export const ConfirmStopSaving: Story = {
  args: { stage: 'saving', source: STORY_SOURCE_UPLOADING },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('puzzle-load-stop'));
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByText('Stop saving the Lichess file?')
    ).toBeVisible();
  },
};

/** Choosing to upload calls the save once. */
export const SaveChosenFile: Story = {
  args: { source: STORY_SOURCE_CHOSEN },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('puzzle-source-save'));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
  },
};
