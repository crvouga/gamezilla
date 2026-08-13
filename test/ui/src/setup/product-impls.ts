/**
 * Compose product system implements + in-process Driver launch for `@test/ui`.
 */

import path from 'node:path';
import { apiResource } from '@apps/api/system/api-resource';
import { clientUnstableSettings } from '@apps/client/providers/client-root-layout';
import { createClientResource } from '@apps/client/system/client-resource';
import { roomResource } from '@apps/room/system/room-resource';
import { jest } from '@jest/globals';
import { wallClock } from '@pkgs/clock';
import type { InMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import type { ResourceImpl } from '@pkgs/system';
import {
  createDriver,
  createRenderedAppFromRntl,
  type Driver,
  type RenderedApp,
} from '@pkgs/ui-testing';
import { act, render } from '@testing-library/react-native';
import { ExpoRoot } from 'expo-router';
import 'expo-router/testing-library';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import { createClientAppRouterContext } from './build-client-app-router-context';
import { SIM_API_URL } from './migrate-sim-sqlite';
import { createActorClientSeams, simNodeTimers } from './sim-actor-overrides';

const CLIENT_APP_DIR = path.resolve(
  __dirname,
  '../../../../apps/client/src/app'
);

const INITIAL_PATH = '/';

function neuterJestFakeTimers(): void {
  jest.useFakeTimers = ((..._args: unknown[]) =>
    jest) as typeof jest.useFakeTimers;
  jest.useRealTimers();
}

function wrapRenderedApp(app: RenderedApp): RenderedApp {
  return {
    ...app,
    unmount: async () => {
      try {
        await app.unmount();
      } catch {
        // expo-router / DevMenu teardown can throw once Jest starts tearing down.
      }
    },
  };
}

const driverWait = {
  now: () => {
    jest.useRealTimers();
    return wallClock.now();
  },
  timers: {
    setTimeout: (fn: () => void, ms: number) => {
      jest.useRealTimers();
      return simNodeTimers.setTimeout(fn, ms);
    },
    clearTimeout: (handle: unknown) => {
      simNodeTimers.clearTimeout(handle);
    },
    setInterval: (fn: () => void, ms: number) => {
      jest.useRealTimers();
      return simNodeTimers.setInterval(fn, ms);
    },
    clearInterval: (handle: unknown) => {
      simNodeTimers.clearInterval(handle);
    },
  },
};

export function createProductClientResource(args: {
  readonly pubSubBus: InMemoryBus;
}): ResourceImpl<unknown, Driver> {
  return createClientResource({
    apiUrl: SIM_API_URL,
    timers: simNodeTimers,
    buildOverrides: ({ apiUrl, ctx }) => {
      const seams = createActorClientSeams({
        apiUrl,
        pubSubBus: args.pubSubBus,
        nodeId: ctx.address,
      });
      return seams.overrides;
    },
    launchDriver: async ({ app }) => {
      const driver = createDriver({
        kind: 'in-process',
        now: driverWait.now,
        timers: driverWait.timers,
        harness: {
          mount: async () => {
            neuterJestFakeTimers();
            process.env['EXPO_ROUTER_IMPORT_MODE'] = 'sync';
            const context = createClientAppRouterContext(CLIENT_APP_DIR, {
              default: app.RootLayout,
              unstable_settings: clientUnstableSettings,
            });
            const result = render(
              createElement(ExpoRoot, {
                context,
                location: INITIAL_PATH,
              })
            );
            jest.useRealTimers();
            await act(async () => {
              await Promise.resolve();
            });
            await new Promise<void>((resolve) => {
              simNodeTimers.setTimeout(resolve, 0);
            });
            await act(async () => {
              await Promise.resolve();
            });
            jest.useRealTimers();
            return wrapRenderedApp(createRenderedAppFromRntl(result));
          },
        },
      });
      await driver.launch();
      return driver;
    },
  });
}

export function createProductImpls(args: {
  readonly pubSubBus: InMemoryBus;
}): ResourceImpl<unknown, unknown>[] {
  return [apiResource, roomResource, createProductClientResource(args)];
}
