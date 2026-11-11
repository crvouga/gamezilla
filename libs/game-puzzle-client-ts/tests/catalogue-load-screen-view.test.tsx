/** @jsxImportSource solid-js */
/**
 * The catalogue loader's contract: which place holds which control, and
 * what each named state shows.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test';
import type {
  CatalogueLoadCopy,
  CatalogueLoadJob,
} from '@libs/game-puzzle-client-ts/catalogue-load-client';
import {
  CatalogueLoadScreenView,
  type CatalogueLoadScreenViewProps,
} from '@libs/game-puzzle-client-ts/catalogue-load-screen-view';
import type { CatalogueSourceView } from '@libs/game-puzzle-client-ts/catalogue-load-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

afterEach(cleanup);

const COPY: CatalogueLoadCopy = {
  title: () => 'Load chess puzzles',
  subtitle: () => 'Upload a missing Lichess file, then load its puzzles.',
  sourceName: 'Lichess file',
  fileLabel: () => 'Lichess puzzle database',
  fileAccept: '.csv',
  fileHint: () => 'Choose a .csv or .csv.zst file.',
};

const SAVED: CatalogueSourceView = {
  status: 'saved',
  filename: 'lichess.csv',
  chosen: null,
  checkError: null,
  saveError: null,
  upload: null,
};
const MISSING: CatalogueSourceView = {
  ...SAVED,
  status: 'missing',
  filename: null,
};
const CHOSEN: CatalogueSourceView = {
  ...MISSING,
  status: 'chosen',
  chosen: 'alice-lichess.csv',
};
const UPLOADING: CatalogueSourceView = {
  ...CHOSEN,
  status: 'uploading',
  upload: { progress: 0.5, puzzles: 12 },
};

const JOB: CatalogueLoadJob = {
  status: 'adding',
  source: 'lichess.csv',
  progress: 0.25,
  processed: 5,
  added: 3,
  updated: 0,
  broken: 2,
  duplicates: 0,
  error: null,
  updatedAt: '2023-11-14T22:10:00.000Z',
  finishedAt: null,
};

const BASE: CatalogueLoadScreenViewProps = {
  frame: { kind: 'embedded' },
  copy: COPY,
  stage: 'ready',
  place: { screen: 'load' },
  onOpen: () => undefined,
  link: 'live',
  pool: 7,
  job: null,
  source: SAVED,
  onSelectFile: () => undefined,
  onSave: async () => undefined,
  onRecheck: () => undefined,
  onStart: async () => undefined,
  onStop: async () => undefined,
};

function mount(ui: () => JSX.Element): void {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SurfaceStackProvider>{ui()}</SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

function loader(props: Partial<CatalogueLoadScreenViewProps> = {}): void {
  mount(() => <CatalogueLoadScreenView {...BASE} {...props} />);
}

const shown = (id: string): boolean => screen.queryByTestId(id) !== null;
const disabled = (id: string): boolean =>
  screen.getByTestId(id).hasAttribute('disabled');

/** Every control of the `source` place: none of them belongs on the hub. */
const SOURCE_CONTROLS = [
  'puzzle-source-place',
  'puzzle-source-saved',
  'puzzle-source-chosen',
  'puzzle-source-checking',
  'puzzle-source-check-offline',
  'puzzle-source-error',
  'puzzle-source-recheck',
  'puzzle-source-missing',
  'puzzle-load-file',
  'puzzle-source-save',
  'puzzle-source-save-error',
  'puzzle-source-saving',
  'puzzle-source-progress',
];

/** Every control of the `load` hub: none of them belongs on the source place. */
const HUB_CONTROLS = [
  'puzzle-load-hub',
  'puzzle-load-pool',
  'puzzle-load-source',
  'puzzle-load-start',
  'puzzle-load-result',
  'puzzle-load-status',
];

describe('the loader says where it stands', () => {
  test('its content names the stage and the place shown', () => {
    loader({ stage: 'loading', job: JOB });
    const content = screen.getByTestId('puzzle-load-content');
    expect(content.getAttribute('data-stage')).toBe('loading');
    expect(content.getAttribute('data-place')).toBe('load');
  });

  test('a denied person is shown the denial and nothing of the load', () => {
    loader({
      stage: 'denied',
      place: { screen: 'status' },
      link: 'offline',
      denial: {
        icon: KeyRoundIcon,
        title: 'Only the puzzle team can load puzzles',
        dataSet: { testid: 'permission-denial', reason: 'not_granted' },
      },
    });
    expect(screen.getByTestId('permission-denial').textContent).toContain(
      'Only the puzzle team'
    );
    for (const id of [
      ...HUB_CONTROLS,
      ...SOURCE_CONTROLS,
      'puzzle-load-offline',
    ])
      expect(shown(id)).toBe(false);
  });
});

describe('the load hub', () => {
  test('holds the pool, the source row and the one command; no source control', () => {
    loader();
    expect(screen.getByTestId('puzzle-load-pool').textContent).toContain('7');
    expect(screen.getByTestId('puzzle-load-source').textContent).toContain(
      'lichess.csv'
    );
    expect(disabled('puzzle-load-start')).toBe(false);
    expect(shown('puzzle-load-stop')).toBe(false);
    expect(shown('puzzle-load-result')).toBe(false);
    for (const id of SOURCE_CONTROLS) expect(shown(id)).toBe(false);
  });

  test('the source row opens the source place', () => {
    const onOpen = mock(() => undefined);
    loader({ onOpen });
    fireEvent.click(screen.getByTestId('puzzle-load-source'));
    expect(onOpen).toHaveBeenCalledWith({ screen: 'source' });
  });

  test('while loading the one command is Stop, beside the latest figures', () => {
    loader({ stage: 'loading', job: JOB });
    expect(shown('puzzle-load-start')).toBe(false);
    expect(disabled('puzzle-load-stop')).toBe(false);
    expect(screen.getByTestId('puzzle-load-status').textContent).toBe(
      'Adding puzzles'
    );
    expect(screen.getByTestId('puzzle-load-added').textContent).toContain('3');
    expect(screen.getByTestId('puzzle-load-broken').textContent).toContain('2');
  });

  test.each([
    ['finished', 'Finished'],
    ['failed', 'Failed'],
    ['stopped', 'Stopped'],
  ] as const)('a %s load says so and can be started again', (status, word) => {
    loader({
      stage: status,
      job: { ...JOB, status, error: status === 'failed' ? 'incomplete' : null },
    });
    expect(screen.getByTestId('puzzle-load-status').textContent).toBe(word);
    expect(disabled('puzzle-load-start')).toBe(false);
    expect(shown('puzzle-load-stop')).toBe(false);
    expect(shown('puzzle-load-error')).toBe(status === 'failed');
  });

  test('offline says so, keeps the last figures and disables the command', () => {
    loader({ stage: 'loading', link: 'offline', job: JOB });
    expect(shown('puzzle-load-offline')).toBe(true);
    expect(disabled('puzzle-load-stop')).toBe(true);
    expect(screen.getByTestId('puzzle-load-added').textContent).toContain('3');
    cleanup();
    loader({ link: 'offline' });
    expect(shown('puzzle-load-offline')).toBe(true);
    expect(disabled('puzzle-load-start')).toBe(true);
  });

  test.each([
    [{ source: MISSING }, 'no-source'],
    [{ source: CHOSEN }, 'no-source'],
    [{ source: { ...SAVED, status: 'checking' } }, 'checking'],
  ] as const)(
    'starting is unavailable with its reason said: %#',
    (props, reason) => {
      loader(props);
      expect(disabled('puzzle-load-start')).toBe(true);
      expect(
        screen.getByTestId('puzzle-load-blocked').getAttribute('data-reason')
      ).toBe(reason);
    }
  );

  test('a file seen before a failed check can still be loaded from', () => {
    loader({
      source: { ...SAVED, status: 'check-failed', checkError: 'unreachable' },
    });
    expect(disabled('puzzle-load-start')).toBe(false);
  });

  test('starting waits for the status to connect', () => {
    loader({ link: 'connecting' });
    expect(disabled('puzzle-load-start')).toBe(true);
    expect(screen.getByText('Connecting to puzzle status…')).toBeTruthy();
  });
});

describe('the source place', () => {
  const source = (
    view: CatalogueSourceView,
    more: Partial<CatalogueLoadScreenViewProps> = {}
  ) => loader({ place: { screen: 'source' }, source: view, ...more });

  test('holds no hub control', () => {
    source(SAVED);
    expect(shown('puzzle-source-place')).toBe(true);
    for (const id of HUB_CONTROLS) expect(shown(id)).toBe(false);
  });

  test('a saved file is named, and can be checked again', () => {
    source(SAVED);
    expect(screen.getByTestId('puzzle-source-saved').textContent).toBe(
      'Saved Lichess filelichess.csv'
    );
    expect(disabled('puzzle-source-recheck')).toBe(false);
    expect(shown('puzzle-source-missing')).toBe(false);
    expect(shown('puzzle-load-file')).toBe(false);
    expect(shown('puzzle-source-save')).toBe(false);
  });

  test('a check under way keeps the file seen before and offers no other check', () => {
    source({ ...SAVED, status: 'checking' });
    expect(shown('puzzle-source-checking')).toBe(true);
    expect(shown('puzzle-source-saved')).toBe(true);
    expect(shown('puzzle-source-recheck')).toBe(false);
    expect(shown('puzzle-source-missing')).toBe(false);
  });

  test('a failed check says why and offers the retry, never another file', () => {
    const onRecheck = mock(() => undefined);
    source(
      { ...MISSING, status: 'check-failed', checkError: 'unreachable' },
      { onRecheck }
    );
    expect(screen.getByTestId('puzzle-source-error').textContent).toContain(
      'unreachable'
    );
    fireEvent.click(screen.getByTestId('puzzle-source-recheck'));
    expect(onRecheck).toHaveBeenCalledTimes(1);
    expect(shown('puzzle-source-missing')).toBe(false);
    expect(shown('puzzle-load-file')).toBe(false);
  });

  test('a missing file asks for one; uploading waits for a choice', () => {
    source(MISSING);
    expect(shown('puzzle-source-missing')).toBe(true);
    expect(
      screen.getByTestId('puzzle-load-file').getAttribute('aria-disabled')
    ).toBe('false');
    expect(disabled('puzzle-source-save')).toBe(true);
    expect(shown('puzzle-source-chosen')).toBe(false);
  });

  test('a chosen file is named and can be uploaded, once', async () => {
    const onSave = mock(async () => undefined);
    source(CHOSEN, { onSave });
    expect(screen.getByTestId('puzzle-source-chosen').textContent).toContain(
      'alice-lichess.csv'
    );
    expect(disabled('puzzle-source-save')).toBe(false);
    fireEvent.click(screen.getByTestId('puzzle-source-save'));
    await Promise.resolve();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test('an upload shows its progress and its stop, and offers nothing else', () => {
    source(UPLOADING, { stage: 'saving' });
    expect(shown('puzzle-source-saving')).toBe(true);
    expect(shown('puzzle-source-progress')).toBe(true);
    expect(shown('puzzle-load-stop')).toBe(true);
    expect(shown('puzzle-source-chosen')).toBe(true);
    for (const id of [
      'puzzle-load-file',
      'puzzle-source-save',
      'puzzle-source-recheck',
      'puzzle-source-missing',
    ])
      expect(shown(id)).toBe(false);
  });

  test('a save that did not finish says why beside its retry', () => {
    source({ ...CHOSEN, saveError: 'Saving stopped.' });
    expect(
      screen.getByTestId('puzzle-source-save-error').textContent
    ).toContain('Saving stopped.');
    expect(disabled('puzzle-source-save')).toBe(false);
  });

  test('offline before any check asks for a connection, not for a file', () => {
    source({ ...MISSING, status: 'unknown' }, { link: 'offline' });
    expect(shown('puzzle-source-check-offline')).toBe(true);
    expect(shown('puzzle-load-offline')).toBe(true);
    expect(shown('puzzle-source-missing')).toBe(false);
    expect(shown('puzzle-load-file')).toBe(false);
  });

  test('offline keeps a chosen file but cannot upload or check', () => {
    source(CHOSEN, { link: 'offline' });
    expect(disabled('puzzle-source-save')).toBe(true);
    expect(disabled('puzzle-source-recheck')).toBe(true);
  });
});

describe('the confirmed stop', () => {
  const modal = (): HTMLElement | null =>
    document.querySelector('[data-testid="puzzle-load-stop-modal"]');

  test('stopping a load asks first and stops only on confirmation', async () => {
    const onStop = mock(async () => undefined);
    loader({ stage: 'loading', job: JOB, onStop });
    expect(modal()).toBeNull();
    fireEvent.click(screen.getByTestId('puzzle-load-stop'));
    expect(modal()?.textContent).toContain('Stop loading puzzles?');
    expect(onStop).not.toHaveBeenCalled();
    fireEvent.click(
      document.querySelector(
        '[data-testid="puzzle-load-stop-confirm"]'
      ) as HTMLElement
    );
    await Promise.resolve();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test('stopping an upload asks in its own words', () => {
    loader({
      stage: 'saving',
      place: { screen: 'source' },
      source: UPLOADING,
    });
    fireEvent.click(screen.getByTestId('puzzle-load-stop'));
    expect(modal()?.textContent).toContain('Stop saving the Lichess file?');
  });

  test('an upload that ends before the answer closes the question, and the dialog survives the place changing', () => {
    const [saving, setSaving] = createSignal(true);
    mount(() => (
      <CatalogueLoadScreenView
        {...BASE}
        stage={saving() ? 'saving' : 'ready'}
        place={saving() ? { screen: 'source' } : { screen: 'load' }}
        source={saving() ? UPLOADING : SAVED}
      />
    ));
    fireEvent.click(screen.getByTestId('puzzle-load-stop'));
    expect(modal()).not.toBeNull();
    setSaving(false);
    expect(shown('puzzle-load-hub')).toBe(true);
    expect(modal()).toBeNull();
  });
});
