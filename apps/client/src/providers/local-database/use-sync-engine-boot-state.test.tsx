/**
 * Regression: product boot paints after local `connect()`, never waits on
 * network `waitForFirstSync`. Uses react-test-renderer so bun test stays RN-free.
 */
import { describe, expect, test } from 'bun:test';
import type { SyncEngine } from '@pkgs/sync-engine/client';
import { act, createElement, type ReactNode, useEffect } from 'react';
import TestRenderer from 'react-test-renderer';

import {
  type SyncEngineBootState,
  useSyncEngineBootState,
} from './use-sync-engine-boot-state';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

function hangingNever(): Promise<void> {
  return new Promise(() => undefined);
}

function mockEngine(args: {
  readonly connect: () => Promise<void>;
  readonly onWaitForFirstSync: () => void;
}): SyncEngine {
  return {
    connect: args.connect,
    waitForFirstSync: () => {
      args.onWaitForFirstSync();
      return hangingNever();
    },
    db: {},
  } as unknown as SyncEngine;
}

function Probe(props: {
  readonly enginePromise: Promise<SyncEngine>;
  readonly warmEngine: SyncEngine | null;
  readonly onBoot: (boot: SyncEngineBootState) => void;
}): ReactNode {
  const boot = useSyncEngineBootState(props.enginePromise, props.warmEngine);
  useEffect(() => {
    props.onBoot(boot);
  }, [boot, props]);
  return null;
}

describe('useSyncEngineBootState', () => {
  test('is ready after connect even when waitForFirstSync never resolves', async () => {
    let waitForFirstSyncCalls = 0;
    const engine = mockEngine({
      connect: async () => undefined,
      onWaitForFirstSync: () => {
        waitForFirstSyncCalls += 1;
      },
    });
    const enginePromise = Promise.resolve(engine);
    let latest: SyncEngineBootState | null = null;

    await act(async () => {
      TestRenderer.create(
        createElement(Probe, {
          enginePromise,
          warmEngine: null,
          onBoot: (boot) => {
            latest = boot;
          },
        })
      );
    });

    await act(async () => {
      await enginePromise;
      await Promise.resolve();
    });

    expect(waitForFirstSyncCalls).toBe(0);
    expect(latest?.phase).toBe('ready');
    if (latest?.phase === 'ready') {
      expect(latest.engine).toBe(engine);
    }
  });

  test('paints a warm engine immediately', async () => {
    const engine = mockEngine({
      connect: async () => undefined,
      onWaitForFirstSync: () => undefined,
    });
    let latest: SyncEngineBootState | null = null;

    await act(async () => {
      TestRenderer.create(
        createElement(Probe, {
          enginePromise: Promise.resolve(engine),
          warmEngine: engine,
          onBoot: (boot) => {
            latest = boot;
          },
        })
      );
    });

    expect(latest?.phase).toBe('ready');
  });
});
