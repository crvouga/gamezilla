import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzleManagementScreenView } from './puzzle-management-screen-view';
import type { PuzzleImportRow } from './use-puzzle-import';

const SAVED = {
  known: true,
  loading: false,
  error: null,
  filename: 'lichess_db_puzzle.csv.zst',
} as const;

const JOB: PuzzleImportRow = {
  source_etag: '"5f2b9c"',
  status: 'adding',
  cursor: 'lichess_db_puzzle.csv.zst',
  processed_rows: 1_250_000,
  inserted_rows: 1_198_400,
  updated_rows: 48_210,
  failed_rows: 12,
  duplicate_rows: 3_378,
  total_chunks: 40,
  completed_chunks: 13,
  pool_rows: 1_246_610,
  error: null,
  created_at: '2023-11-14T20:00:00.000Z',
  updated_at: '2023-11-14T22:10:00.000Z',
  finished_at: null,
};

const meta = {
  id: 'screens-puzzles-management',
  title: 'Screens/Puzzles/Puzzle management',
  component: PuzzleManagementScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['denial', 'job', 'source', 'chosenFile'] },
  },
  args: {
    online: true,
    ready: true,
    job: null,
    source: SAVED,
    chosenFile: null,
    uploading: false,
    uploadProgress: 0,
    uploadedRows: 0,
    onSelectFile: fn(),
    onSave: fn(async () => undefined),
    onRecheck: fn(),
    onStart: fn(async () => undefined),
    onStop: fn(async () => undefined),
  },
} satisfies Meta<typeof PuzzleManagementScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The Lichess file is saved and nothing is loading: start a load. */
export const ReadyToLoad: Story = {};

/** Anyone outside the puzzle team is denied the whole screen. */
export const Denied: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'Only the puzzle team can load puzzles',
      dataSet: { testid: 'permission-denial', reason: 'not_granted' },
    },
  },
};

/** The load status subscription has not answered yet. */
export const Connecting: Story = { args: { ready: false } };

/** Checking the shared bucket for the saved Lichess file. */
export const CheckingSource: Story = {
  args: {
    source: { known: false, loading: true, error: null, filename: null },
  },
};

/** The check failed: its message and a recheck. */
export const SourceCheckFailed: Story = {
  args: {
    source: {
      known: false,
      loading: false,
      error: 'The bucket could not be reached. Check again.',
      filename: null,
    },
  },
};

/** No file is saved yet: choose a .csv or .csv.zst to upload. */
export const SourceMissing: Story = {
  args: {
    source: { known: true, loading: false, error: null, filename: null },
  },
};

/** A file is chosen and ready to upload. */
export const FileChosen: Story = {
  args: {
    source: { known: true, loading: false, error: null, filename: null },
    chosenFile: { name: 'lichess_db_puzzle.csv.zst' },
  },
};

/** The file is uploading; it can be stopped. */
export const Uploading: Story = {
  args: {
    source: { known: true, loading: false, error: null, filename: null },
    chosenFile: { name: 'lichess_db_puzzle.csv.zst' },
    uploading: true,
    uploadProgress: 0.42,
    uploadedRows: 1_640_000,
  },
};

/** A load is adding puzzles in batches; its progress and a stop. */
export const Loading: Story = { args: { job: JOB } };

/** The latest load finished. */
export const Finished: Story = {
  args: {
    job: {
      ...JOB,
      status: 'finished',
      completed_chunks: 40,
      processed_rows: 3_812_000,
      finished_at: '2023-11-14T22:12:00.000Z',
    },
  },
};

/** The latest load failed, with what went wrong. */
export const LoadFailed: Story = {
  args: {
    job: {
      ...JOB,
      status: 'failed',
      error: 'Batch 14 could not be read: unexpected end of file.',
      finished_at: '2023-11-14T22:12:00.000Z',
    },
  },
};

/** The latest load was stopped; what it added stays. */
export const Stopped: Story = {
  args: {
    job: {
      ...JOB,
      status: 'stopped',
      finished_at: '2023-11-14T22:12:00.000Z',
    },
  },
};

/** Offline: the last status shows; nothing can be started or stopped. */
export const Offline: Story = { args: { online: false, job: JOB } };

/** Inside the developer console, titled by its own header. */
export const Embedded: Story = { args: { embedded: true } };

/** Stopping a running load asks first, in a destructive confirm. */
export const ConfirmStop: Story = {
  args: { job: JOB },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('puzzle-load-stop'));
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText('Stop loading puzzles?')).toBeVisible();
  },
};
