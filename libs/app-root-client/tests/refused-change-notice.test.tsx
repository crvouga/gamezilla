import { afterEach, expect, mock, test } from 'bun:test';
import {
  OtherRefusedChanges,
  RefusedChangeNotice,
} from '@libs/app-root-client/refused-change-notice';
import { Handles } from '@libs/test-ids-shared/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client/render';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { MutationClient } from '@pkgs/sync-engine-client/create-mutation-client';
import { MutationClientContext } from '@pkgs/sync-engine-client/mutation-client-context';
import { SyncEngineProvider } from '@pkgs/sync-engine-client/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client/sync-engine-port';
import type { WriteRefusal } from '@pkgs/sync-engine-client/write-outcome-reads';
import { acknowledgeWriteRejectionMutation } from '@pkgs/sync-engine-shared/acknowledge-write-rejection';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup, fireEvent } from '@solidjs/testing-library';

afterEach(cleanup);

const RENAME_REFUSED: WriteRefusal = {
  mutationId: 'rename-1',
  mutationName: 'renameSpace',
  code: 'SPACE_TITLE_NOT_ALLOWED',
  message: 'That space name is not allowed.',
};

const UNKNOWN_REFUSED: WriteRefusal = {
  mutationId: 'other-1',
  mutationName: 'somethingNew',
  code: 'FORBIDDEN',
  message: 'policy denied: rule spaces.rename at depth 3',
};

/** The engine's live refusals, driven by the test. */
function refusalsEngine(initial: readonly WriteRefusal[]) {
  let rows = initial;
  const listeners = new Set<() => void>();
  const engine = {
    unheardRefusals: () => ({
      getSnapshot: () => rows,
      getHydrated: () => true,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  } as unknown as SyncEngine;
  const set = (next: readonly WriteRefusal[]): void => {
    rows = next;
    for (const listener of listeners) listener();
  };
  return { engine, set };
}

const RENAME_AGAIN_REFUSED: WriteRefusal = {
  mutationId: 'rename-2',
  mutationName: 'renameSpace',
  code: 'FORBIDDEN',
  message: 'policy denied',
};

const AVATAR_REFUSED: WriteRefusal = {
  mutationId: 'avatar-1',
  mutationName: 'patchAvatar',
  code: 'FORBIDDEN',
  message: 'policy denied',
};

/** The space's notice and the Sync screen's list, side by side. */
function renderNotices(engine: SyncEngine) {
  const mutate = mock(async () => ({ ok: true as const, mutationId: 'ack' }));
  const client = { mutate } as unknown as MutationClient;
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SyncEngineProvider value={engine}>
          <MutationClientContext.Provider value={client}>
            <StackVertical testId="place-space">
              <RefusedChangeNotice mutations={['renameSpace']} />
            </StackVertical>
            <StackVertical testId="place-sync">
              <OtherRefusedChanges />
            </StackVertical>
          </MutationClientContext.Provider>
        </SyncEngineProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return { mutate };
}

function noticesIn(place: string): readonly HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      `[data-testid="place-${place}"] [data-testid="${Handles.refusedChange}"]`
    ),
  ];
}

function dismiss(notice: HTMLElement | undefined): void {
  const control = notice?.querySelector<HTMLElement>(
    '[data-component="NoticeDismiss"]'
  );
  if (control === null || control === undefined) throw new Error('no dismiss');
  fireEvent.click(control);
}

test('a refused change is told inline where it lives, says what and why, and stays until dismissed', () => {
  // regression: refused-instant-write-silently-undone
  const { engine, set } = refusalsEngine([
    RENAME_REFUSED,
    RENAME_AGAIN_REFUSED,
  ]);
  const { mutate } = renderNotices(engine);
  const [rename, ...rest] = noticesIn('space');
  expect(rest).toHaveLength(0);
  expect(rename?.getAttribute('data-component')).toBe('Notice');
  expect(rename?.getAttribute('data-tone')).toBe('warning');
  expect(rename?.textContent).toContain("Your space wasn't renamed");
  expect(rename?.textContent).toContain('That space name is not allowed.');
  expect(rename?.textContent).toContain('The change was undone.');
  expect(rename?.getAttribute('data-mutation')).toBe('renameSpace');
  expect(rename?.getAttribute('data-code')).toBe('SPACE_TITLE_NOT_ALLOWED');
  // Told in the space, so not again on Sync; nothing floats over the screen.
  expect(noticesIn('sync')).toHaveLength(0);
  expect(
    document.querySelector('[data-component="DismissibleBanner"]')
  ).toBeNull();
  expect(mutate).not.toHaveBeenCalled();

  dismiss(rename);
  expect(mutate).toHaveBeenCalledWith(acknowledgeWriteRejectionMutation, {
    mutationId: RENAME_REFUSED.mutationId,
  });
  // The next one takes its place at once, before the acknowledgement lands.
  expect(noticesIn('space').map((n) => n.textContent ?? '')).toEqual([
    expect.stringContaining('It could not be saved, so it was undone'),
  ]);

  set([RENAME_AGAIN_REFUSED, AVATAR_REFUSED, UNKNOWN_REFUSED]);
  const sync = noticesIn('sync').map((node) => node.textContent ?? '');
  // An avatar change is told on the profile; only the unknown one is on Sync.
  expect(sync).toEqual([expect.stringContaining("A change wasn't saved")]);
  expect(sync.join(' ')).toContain(
    'It could not be saved, so it was undone on this device.'
  );
  // The server's own words are never shown.
  expect(sync.join(' ')).not.toContain('policy denied');
  dismiss(noticesIn('sync')[0]);
  expect(mutate).toHaveBeenLastCalledWith(acknowledgeWriteRejectionMutation, {
    mutationId: UNKNOWN_REFUSED.mutationId,
  });
  expect(noticesIn('sync')).toHaveLength(0);
});
