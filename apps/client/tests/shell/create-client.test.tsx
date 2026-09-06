/** @jsxImportSource solid-js */
import { createClient } from '@apps/client/shell/create-client';
import { Handles } from '@libs/test-ids';
import { createMemoryHistory } from '@solidjs/router';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';

import { type SimClientEnv, simClientEnv } from '../support/sim-client-env';

const BOOT_TIMEOUT_MS = 15_000;
const TAB_HANDLES = [
  Handles.tabSpaces,
  Handles.tabSearch,
  Handles.tabNotifications,
  Handles.tabProfile,
];

function screenNode(screenId: string): Element | null {
  return document.querySelector(`[data-screen="${screenId}"]`);
}

function bootChromeNode(): Element | null {
  return document.querySelector(
    '[data-component="BlankShell"], [data-component="BootPaintGate"]'
  );
}

async function waitForScreen(screenId: string): Promise<Element> {
  return waitFor(
    () => {
      const node = screenNode(screenId);
      if (node === null) throw new Error(`screen ${screenId} not rendered`);
      return node;
    },
    { timeout: BOOT_TIMEOUT_MS }
  );
}

describe('createClient', () => {
  let sim: SimClientEnv | null = null;
  afterEach(async () => {
    await sim?.dispose();
    sim = null;
  });

  it('boots through the paint gate into the tabbed Spaces stub and routes', async () => {
    sim = await simClientEnv({ seed: 7 });
    const client = createClient(sim.env);
    const history = createMemoryHistory();

    const view = render(() => <client.App embedded history={history} />);

    // Boot: the themed blank shell / paint gate shows before any screen.
    expect(bootChromeNode()).not.toBeNull();
    expect(screenNode('spaces')).toBeNull();

    // Identity + local sqlite-mem engine boot are promise-driven; virtual
    // time advances anything the engine scheduled on the injected timers.
    await sim.session.advanceTime(1_000);
    await waitForScreen('spaces');
    expect(bootChromeNode()).toBeNull();

    // Compact layout (happy-dom measures 0px) → bottom tab bar with 4 tabs.
    for (const handle of TAB_HANDLES) {
      expect(screen.getByTestId(handle)).toBeInTheDocument();
    }
    expect(screen.getByTestId(Handles.tabSpaces)).toHaveAttribute(
      'aria-current',
      'page'
    );
    // Global account menu is mounted as the frame's global trailing chrome.
    expect(screen.getByTestId(Handles.statusCurrentUser)).toBeInTheDocument();

    history.set({ value: '/more' });
    await waitForScreen('more');
    expect(screenNode('spaces')).toBeNull();
    expect(screen.queryByTestId(Handles.tabSpaces)).toBeNull();

    history.set({ value: '/definitely/not/a/route' });
    await waitForScreen('not-found');
    expect(screen.getByTestId('route-not-found')).toBeInTheDocument();

    expect(sim.requests).toContain('/api/identity/anon/ensure');
    view.unmount();
    await client.close();
  });
});
