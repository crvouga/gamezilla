import { expect, test } from 'bun:test';
import { ContentConnectionStatus } from '@libs/game-puzzle-client-ts/content-connection-status';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client-ts/sync-status';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

test('a late failed request does not insert another panel above offline authoring', () => {
  // regression: offline-authoring-late-error-layout-shift
  let status = { ...INITIAL_SYNC_STATUS, online: false };
  const listeners = new Set<() => void>();
  let reconnects = 0;
  const engine = {
    watch: () => {
      throw new Error('This notice reads no rows');
    },
    connect: async () => {
      reconnects += 1;
    },
    status: {
      getSnapshot: () => status,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  } as unknown as SyncEngine;
  const view = renderWithI18n(() => (
    <ThemeProvider colorScheme="light">
      <SyncEngineProvider value={engine}>
        <ContentConnectionStatus loading={false} />
      </SyncEngineProvider>
    </ThemeProvider>
  ));
  const offline = view.getByTestId('content-offline');
  const parent = offline.parentElement;
  const panelsBefore = parent?.childElementCount;
  status = { ...status, lastError: 'Failed to fetch' };
  for (const listener of listeners) listener();
  expect(parent?.childElementCount).toBe(panelsBefore);
  expect(
    view.queryByText('Changes have not reached your other devices')
  ).toBeNull();
  expect(view.getByTestId('content-offline')).toBe(offline);
  fireEvent.click(view.getByRole('button', { name: 'Reconnect' }));
  expect(reconnects).toBe(1);
  status = { ...status, online: true };
  for (const listener of listeners) listener();
  expect(
    view.getByText('Changes have not reached your other devices')
  ).toBeInTheDocument();
  expect(view.getByText('Failed to fetch')).toBeInTheDocument();
});
