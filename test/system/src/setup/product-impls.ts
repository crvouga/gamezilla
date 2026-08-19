/**
 * Product system implements for `@test/system` DST.
 */

import { apiResource } from '@apps/api/system/api-resource';
import { App } from '@apps/client/product/app';
import { ioFromResourceCtx } from '@apps/client/system/client-resource';
import { roomResource } from '@apps/room/system/room-resource';
import { client } from '@libs/runtime/shared/system';
import { type Timers, wallClock } from '@pkgs/clock';
import type { InMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import type { ResourceImpl } from '@pkgs/system';
import {
  createDriver,
  createRenderedAppFromRntl,
  type Driver,
} from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';
import { act, render } from '@testing-library/react-native';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import type { OpenSimFidelity } from './fidelity';
import { SIM_API_URL } from './migrate-sim-sqlite';
import { createActorClientSeams } from './sim-actor-overrides';

function injectedPlaywrightPage(): Page | undefined {
  const holder = globalThis as { readonly __PLAYWRIGHT_PAGE__?: Page };
  return holder.__PLAYWRIGHT_PAGE__;
}

function createClientDriver(args: {
  readonly fidelity: OpenSimFidelity;
  readonly io: ReturnType<typeof ioFromResourceCtx>;
  readonly seams: ReturnType<typeof createActorClientSeams>;
  readonly timers: Timers;
}): Driver {
  const page = injectedPlaywrightPage();
  const baseUrl = process.env['PLAYWRIGHT_BASE_URL'];
  if (args.fidelity === 'max' && page !== undefined && baseUrl !== undefined) {
    return createDriver({ kind: 'playwright', page, baseUrl });
  }
  return createDriver({
    kind: 'in-process',
    now: () => wallClock.now(),
    timers: args.timers,
    harness: {
      mount: async () => {
        const result = render(
          createElement(App, {
            io: args.io,
            resources: args.seams.resources,
          })
        );
        await act(async () => {
          await Promise.resolve();
        });
        return createRenderedAppFromRntl(result);
      },
    },
  });
}

export function createProductClientResource(args: {
  readonly pubSubBus: InMemoryBus;
  readonly fidelity: OpenSimFidelity;
}): ResourceImpl<unknown, Driver> {
  return client.implement<Driver>(async (deps, ctx) => {
    const io = ioFromResourceCtx(ctx, (input, init) => deps.api(input, init));
    const seams = createActorClientSeams({
      apiUrl: SIM_API_URL,
      pubSubBus: args.pubSubBus,
      nodeId: ctx.address,
    });
    const driver = createClientDriver({
      fidelity: args.fidelity,
      io,
      seams,
      timers: ctx.timers,
    });
    await driver.launch();
    return driver;
  });
}

export function createProductImpls(args: {
  readonly pubSubBus: InMemoryBus;
  readonly fidelity: OpenSimFidelity;
}): ResourceImpl<unknown, unknown>[] {
  return [apiResource, roomResource, createProductClientResource(args)];
}
