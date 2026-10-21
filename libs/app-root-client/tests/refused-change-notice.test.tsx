import { afterEach, expect, mock, test } from 'bun:test';
import { RefusedChangeNotice } from '@libs/app-root-client/refused-change-notice';
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
import { DismissibleBannerPortalProvider } from '@pkgs/ui-root-client/dismissible-top-banner';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

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

function renderNotice(engine: SyncEngine) {
  const mutate = mock(async () => ({ ok: true as const, mutationId: 'ack' }));
  const client = { mutate } as unknown as MutationClient;
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <DismissibleBannerPortalProvider>
          <SyncEngineProvider value={engine}>
            <MutationClientContext.Provider value={client}>
              <RefusedChangeNotice />
            </MutationClientContext.Provider>
          </SyncEngineProvider>
        </DismissibleBannerPortalProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return mutate;
}

function notice(): HTMLElement | null {
  return document.querySelector(`[data-testid="${Handles.refusedChange}"]`);
}

test('a refused rename says what was not saved and why, and dismissing acknowledges it', () => {
  // regression: refused-instant-write-silently-undone
  const { engine, set } = refusalsEngine([RENAME_REFUSED, UNKNOWN_REFUSED]);
  const mutate = renderNotice(engine);
  expect(notice()?.textContent).toContain("Your space wasn't renamed");
  expect(notice()?.textContent).toContain('That space name is not allowed.');
  expect(notice()?.textContent).toContain('The change was undone.');
  expect(notice()?.getAttribute('data-mutation')).toBe('renameSpace');
  fireEvent.click(screen.getByLabelText('Dismiss'));
  expect(mutate).toHaveBeenCalledWith(acknowledgeWriteRejectionMutation, {
    mutationId: RENAME_REFUSED.mutationId,
  });
  set([UNKNOWN_REFUSED]);
  expect(notice()?.textContent).toContain("A change wasn't saved");
  expect(notice()?.textContent).toContain(
    'It could not be saved, so it was undone on this device.'
  );
  // The server's own words are never shown.
  expect(notice()?.textContent).not.toContain('policy denied');
  set([]);
  expect(notice()).toBeNull();
});
