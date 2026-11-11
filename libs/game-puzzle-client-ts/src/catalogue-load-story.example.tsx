import { fn } from 'storybook/test';
import type {
  CatalogueLoadCopy,
  CatalogueLoadJob,
} from './catalogue-load-client';
import type { CatalogueLoadScreenViewProps } from './catalogue-load-screen-view';
import type { CatalogueSourceView } from './catalogue-load-view';

/** The words a game gives the loader: here a Lichess puzzle database. */
export const STORY_LOAD_COPY: CatalogueLoadCopy = {
  title: () => 'Load chess puzzles',
  subtitle: () =>
    'Upload a missing Lichess file, then load its puzzles into this environment.',
  sourceName: 'Lichess file',
  fileLabel: () => 'Lichess puzzle database',
  fileAccept: '.csv,.csv.zst,.zst,text/csv',
  fileHint: () => 'Choose a .csv or .csv.zst file.',
};

const FILE = 'lichess_db_puzzle.csv.zst';

/** The shared file is saved and its last check found it. */
export const STORY_SOURCE_SAVED: CatalogueSourceView = {
  status: 'saved',
  filename: FILE,
  chosen: null,
  checkError: null,
  saveError: null,
  upload: null,
};

/** The last check found no shared file. */
export const STORY_SOURCE_MISSING: CatalogueSourceView = {
  ...STORY_SOURCE_SAVED,
  status: 'missing',
  filename: null,
};

/** A file is chosen on this device and not saved yet. */
export const STORY_SOURCE_CHOSEN: CatalogueSourceView = {
  ...STORY_SOURCE_MISSING,
  status: 'chosen',
  chosen: FILE,
};

/** The chosen file is uploading. */
export const STORY_SOURCE_UPLOADING: CatalogueSourceView = {
  ...STORY_SOURCE_CHOSEN,
  status: 'uploading',
  upload: { progress: 0.42, puzzles: 1_640_000 },
};

/** A load adding puzzles in batches. */
export const STORY_LOAD_JOB: CatalogueLoadJob = {
  status: 'adding',
  source: FILE,
  progress: 13 / 40,
  processed: 1_250_000,
  added: 1_198_400,
  updated: 48_210,
  broken: 12,
  duplicates: 3_378,
  error: null,
  updatedAt: '2023-11-14T22:10:00.000Z',
  finishedAt: null,
};

/** The loader's hub, ready to load from a saved file, inside a space. */
export const STORY_LOAD_ARGS = {
  frame: { kind: 'embedded' },
  copy: STORY_LOAD_COPY,
  stage: 'ready',
  place: { screen: 'load' },
  onOpen: fn(),
  link: 'live',
  pool: 1_246_610,
  job: null,
  source: STORY_SOURCE_SAVED,
  onSelectFile: fn(),
  onSave: fn(async () => undefined),
  onRecheck: fn(),
  onStart: fn(async () => undefined),
  onStop: fn(async () => undefined),
} satisfies CatalogueLoadScreenViewProps;
