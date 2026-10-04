/** @jsxImportSource solid-js */

import { afterEach, describe, expect, it } from 'bun:test';
import { createClient } from '@libs/app-client/create-client';
import { APP } from '@libs/runtime-shared/app-features';
import { APP_FEATURE_CLIENTS } from '@libs/runtime-client/app-feature-clients';
import { Handles } from '@libs/test-ids-shared/handles';
import { createMemoryHistory } from '@solidjs/router';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

import type { HarnessClientEnv } from './harness-client-env';
import { harnessClientEnv } from './harness-client-env';

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
    '[data-component="BootLoadingShell"], [data-component="BootPaintGate"], [data-component="LocalDatabaseBootErrorScreen"]'
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

function stubHostSize(size: { width: number; height: number }): () => void {
  const proto = HTMLElement.prototype;
  const original = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return new DOMRect(0, 0, size.width, size.height);
  };
  return () => {
    proto.getBoundingClientRect = original;
  };
}

/**
 * The real composition: every feature the product ships, folded by the same
 * `createClient` a subsystem harness calls with one. This is the thin
 * full-composition layer — it invalidates whenever any feature changes, by
 * design, so it stays small and is never skipped.
 */
describe('app composition', () => {
  let harness: HarnessClientEnv | null = null;
  let restoreHostSize: (() => void) | null = null;
  afterEach(async () => {
    restoreHostSize?.();
    restoreHostSize = null;
    await harness?.dispose();
    harness = null;
  });

  it('boots through the paint gate into the tabbed Spaces screen and routes', async () => {
    harness = await harnessClientEnv({ seed: 7 });
    const client = createClient(harness.env, {
      features: APP_FEATURE_CLIENTS,
      loadApp: () => Promise.resolve(APP),
    });
    const history = createMemoryHistory();

    const view = render(() => <client.App embedded history={history} />);

    // Boot: the themed blank shell / paint gate shows before any screen.
    expect(bootChromeNode()).not.toBeNull();
    expect(screenNode('spaces')).toBeNull();

    // Identity + local mockingbird-sqlite engine boot are promise-driven; virtual
    // time advances anything the engine scheduled on the injected timers.
    await harness.session.advanceTime(1_000);
    await harness.session.waitForIdle();
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

    expect(harness.requests).toContain('/api/identity/anon/ensure');
    view.unmount();
    await client.close();
  }, 30_000);

  it('paints the wide header island without crashing on notifications chrome', async () => {
    restoreHostSize = stubHostSize({ width: 1280, height: 900 });
    harness = await harnessClientEnv({ seed: 11 });
    const client = createClient(harness.env, {
      features: APP_FEATURE_CLIENTS,
      loadApp: () => Promise.resolve(APP),
    });
    const history = createMemoryHistory();

    const view = render(() => <client.App embedded history={history} />);
    await harness.session.advanceTime(1_000);
    await harness.session.waitForIdle();
    await waitForScreen('spaces');

    expect(screen.queryByText('App crashed!')).toBeNull();
    expect(
      document.querySelector('[data-component="AppHeaderIsland"]')
    ).not.toBeNull();
    expect(
      document.querySelector('[data-component="AppFrame"]')
    ).toHaveAttribute('data-mode', 'wide');
    for (const handle of TAB_HANDLES) {
      expect(screen.getByTestId(handle)).toBeInTheDocument();
    }

    view.unmount();
    await client.close();
  }, 30_000);

  it('opens the account menu without a surface-stack crash', async () => {
    harness = await harnessClientEnv({ seed: 13 });
    const client = createClient(harness.env, {
      features: APP_FEATURE_CLIENTS,
      loadApp: () => Promise.resolve(APP),
    });
    const history = createMemoryHistory();
    const view = render(() => <client.App embedded history={history} />);
    await harness.session.advanceTime(1_000);
    await harness.session.waitForIdle();
    await waitForScreen('spaces');

    fireEvent.click(screen.getByTestId(Handles.statusCurrentUser));
    expect(screen.queryByText('App crashed!')).toBeNull();
    expect(screen.getByTestId(Handles.globalMenuSettings)).toBeInTheDocument();

    view.unmount();
    await client.close();
  }, 30_000);
});
