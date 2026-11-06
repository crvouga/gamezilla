import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  browserNetworkEvidence,
  readSyncResponseEvidence,
} from '@apps/product-ts/browser-network-evidence';
import {
  EVIDENCE_DIR,
  emulateOffline,
  openDevice,
  waitForCachedShell,
} from '@apps/product-ts/live-browser';
import {
  createJourneyStepRecorder,
  type JourneyStepView,
} from '@apps/product-ts/live-journey-step-evidence';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  readObjectBytes,
  readUtf8,
} from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

test('transport evidence keeps protocol failures without copying credentials or query strings', () => {
  const listeners = new Map<string, (event: { data: unknown }) => void>();
  const view = {
    addEventListener: (
      name: string,
      listener: (event: { data: unknown }) => void
    ) => listeners.set(name, listener),
  } as unknown as Bun.WebView;
  const evidence = browserNetworkEvidence(view);
  listeners.get('Network.requestWillBeSent')!({
    data: {
      requestId: 'one',
      request: { url: 'https://api.example/api/health?token=private-token' },
    },
  });
  listeners.get('Network.responseReceived')!({
    data: {
      requestId: 'one',
      response: {
        status: 200,
        protocol: 'h2',
        headers: { 'set-cookie': 'private-cookie' },
      },
    },
  });
  listeners.get('Network.loadingFailed')!({
    data: {
      requestId: 'one',
      errorText: 'net::ERR_HTTP2_PROTOCOL_ERROR',
      canceled: false,
    },
  });
  expect(
    evidence.map((line) => (JSON.parse(line) as { event: string }).event)
  ).toEqual(['request', 'response', 'failed']);
  expect(evidence.join('\n')).toContain('ERR_HTTP2_PROTOCOL_ERROR');
  expect(evidence.join('\n')).not.toContain('private-');
});

// regression: live-network-evidence-competes-for-cdp
test('network observation leaves the gesture CDP channel alone until failure collection', async () => {
  const listeners = new Map<string, (event: { data: unknown }) => void>();
  let calls = 0;
  const view = {
    addEventListener: (
      name: string,
      listener: (event: { data: unknown }) => void
    ) => listeners.set(name, listener),
    cdp: async () => {
      calls++;
      return {
        body: JSON.stringify({
          responses: [
            {
              status: 'ok',
              checkpoint: '3',
              tables: { games: [{ id: 'private-id', deleted_at: null }] },
            },
          ],
        }),
      };
    },
  } as unknown as Bun.WebView;
  const evidence = browserNetworkEvidence(view);
  listeners.get('Network.requestWillBeSent')!({
    data: {
      requestId: 'query',
      request: { url: 'https://api.example/api/query' },
    },
  });
  listeners.get('Network.loadingFinished')!({ data: { requestId: 'query' } });
  expect(calls).toBe(0);
  const responses = await readSyncResponseEvidence(view, evidence);
  expect(calls).toBe(1);
  expect(responses.join('\n')).toContain('games');
  expect(responses.join('\n')).not.toContain('private-id');
});

// regression: health-journey-evidence-outside-package
test('live journey evidence lives in the package directory uploaded by CI', () => {
  expect(EVIDENCE_DIR).toBe(
    join(import.meta.dir, '../.cache/critical-journeys')
  );
});

// regression: health-macos-offline-network
// regression: health-offline-existing-room-socket
// regression: health-profile-deleted-between-devices
test('a fresh live device can cut its network through Chrome', async () => {
  const commands: { method: string; params: unknown }[] = [];
  let closed = false;
  const device = await openDevice(
    { webOrigin: 'https://web.example', apiOrigin: 'https://api.example' },
    (options) => {
      expect(options.dataStore).toBe('ephemeral');
      expect(options.backend).toEqual({ type: 'chrome', url: false });
      const backend =
        typeof options.backend === 'object'
          ? options.backend.type
          : (options.backend ?? 'webkit');
      return {
        navigate: async () => {},
        addEventListener: () => {},
        evaluate: async () => 'active',
        cdp: async (method: string, params: unknown) => {
          if (backend !== 'chrome') throw new Error('WebKit has no CDP');
          commands.push({ method, params });
        },
        close: () => {
          closed = true;
        },
      } as unknown as Bun.WebView;
    }
  );
  try {
    await emulateOffline(device.view);
    expect(commands).toEqual([
      { method: 'Network.enable', params: undefined },
      {
        method: 'Storage.clearDataForOrigin',
        params: { origin: 'https://web.example', storageTypes: 'all' },
      },
      {
        method: 'Storage.clearDataForOrigin',
        params: { origin: 'https://api.example', storageTypes: 'all' },
      },
      {
        method: 'Network.emulateNetworkConditions',
        params: {
          offline: true,
          latency: 0,
          downloadThroughput: 0,
          uploadThroughput: 0,
        },
      },
    ]);
  } finally {
    await device.close();
  }
  expect(closed).toBe(true);
});

// regression: health-offline-before-precache-ready
test('a cold install taking more than twenty seconds stays online until ready', async () => {
  const { clock, timers } = createHarnessClock();
  const ready = new Promise((resolve) => {
    timers.setTimeout(() => resolve({ active: {} }), 25_000);
  });
  const view = {
    evaluate: (script: string) =>
      runInNewContext(script, {
        navigator: { serviceWorker: { ready } },
      }),
  } as unknown as Bun.WebView;
  let settled = false;
  const waiting = waitForCachedShell(view).then(() => {
    settled = true;
  });
  clock.advance(20_000);
  await Promise.resolve();
  expect(settled).toBe(false);
  clock.advance(5_000);
  await waiting;
  expect(settled).toBe(true);
});

test('an unavailable offline shell fails the readiness check', async () => {
  const view = {
    evaluate: (script: string) => runInNewContext(script, { navigator: {} }),
  } as unknown as Bun.WebView;
  await expect(waitForCachedShell(view)).rejects.toThrow(
    'no service worker support'
  );
});

const SUCCESS_STEP = { keyword: 'When ', text: 'the person opens a space' };

function successfulStepView(): JourneyStepView {
  return {
    evaluate: async () => 'https://example.test/space/one?token=secret#secret',
    screenshot: async () => new Uint8Array([137, 80, 78, 71]),
  };
}

test('successful journey step evidence follows completed actions and preserves ordered screenshots', async () => {
  const store = new ObjectStoreImplInMemory();
  let shown: JourneyStepView | null = null;
  const record = createJourneyStepRecorder('space.open', store, () => shown);
  expect(await record(SUCCESS_STEP, async () => 'before browser')).toBe(
    'before browser'
  );
  const result = await record(SUCCESS_STEP, async () => {
    shown = successfulStepView();
    return 'completed';
  });
  expect(result).toBe('completed');
  expect(JSON.parse((await readUtf8(store, 'space.open/steps/0001.json'))!))
    .toEqual({
      scenarioId: 'space.open',
      index: 1,
      action: 'When the person opens a space',
      status: 'passed',
      url: null,
      screenshot: null,
    });
  expect(JSON.parse((await readUtf8(store, 'space.open/steps/0002.json'))!))
    .toEqual({
      scenarioId: 'space.open',
      index: 2,
      action: 'When the person opens a space',
      status: 'passed',
      url: 'https://example.test/space/one',
      screenshot: 'space.open/steps/0002.png',
    });
  expect(await readObjectBytes(store, 'space.open/steps/0002.png')).toEqual(
    new Uint8Array([137, 80, 78, 71])
  );
  const other = createJourneyStepRecorder('space.leave', store, () => shown);
  await other(SUCCESS_STEP, async () => undefined);
  expect(await readUtf8(store, 'space.leave/steps/0001.json')).not.toBeNull();
});

test('successful journey step evidence is inert when disabled and never captures a failed step', async () => {
  const cause = new Error('step failed');
  const unexpectedView = () => {
    throw new Error('must not read browser');
  };
  const disabled = createJourneyStepRecorder('disabled', null, unexpectedView);
  expect(await disabled(SUCCESS_STEP, async () => 42)).toBe(42);
  await expect(
    disabled(SUCCESS_STEP, async () => {
      throw cause;
    })
  ).rejects.toBe(cause);
  const store = new ObjectStoreImplInMemory();
  const enabled = createJourneyStepRecorder('failed', store, unexpectedView);
  await expect(
    enabled(SUCCESS_STEP, async () => {
      throw cause;
    })
  ).rejects.toBe(cause);
  expect(await readUtf8(store, 'failed/steps/0001.json')).toBeNull();
  expect(await readObjectBytes(store, 'failed/steps/0001.png')).toBeNull();
});

test('successful journey step evidence cannot claim a screenshot when capture fails', async () => {
  const store = new ObjectStoreImplInMemory();
  const captureFailure = new Error('browser capture unavailable');
  const record = createJourneyStepRecorder('capture', store, () => ({
    ...successfulStepView(),
    screenshot: async () => {
      throw captureFailure;
    },
  }));
  await expect(record(SUCCESS_STEP, async () => undefined)).rejects.toBe(
    captureFailure
  );
  expect(await readUtf8(store, 'capture/steps/0001.json')).toBeNull();
});
