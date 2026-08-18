/**
 * Product system implements for `@test/system` DST.
 */

import { apiResource } from '@apps/api/system/api-resource';
import { App } from '@apps/client/product/app';
import { ioFromResourceCtx } from '@apps/client/system/client-resource';
import { roomResource } from '@apps/room/system/room-resource';
import { client } from '@libs/runtime/shared/system';
import { wallClock } from '@pkgs/clock';
import type { InMemoryBus } from '@pkgs/pubsub/testing/in-memory';
import type { ResourceImpl } from '@pkgs/system';
import {
  createDriver,
  createRenderedAppFromRntl,
  type Driver,
} from '@pkgs/ui-testing';
import { act, render } from '@testing-library/react-native';
import { createElement } from 'react';

import '@apps/client/i18n/i18n';

import { SIM_API_URL } from './migrate-sim-sqlite';
import { createActorClientSeams } from './sim-actor-overrides';

export function createProductClientResource(args: {
  readonly pubSubBus: InMemoryBus;
}): ResourceImpl<unknown, Driver> {
  return client.implement<Driver>(async (deps, ctx) => {
    const io = ioFromResourceCtx(ctx, (input, init) => deps.api(input, init));
    const seams = createActorClientSeams({
      apiUrl: SIM_API_URL,
      pubSubBus: args.pubSubBus,
      nodeId: ctx.address,
    });
    const driver = createDriver({
      kind: 'in-process',
      // UI poll deadlines must track wall time — ctx.timers are real node timers
      // while ctx.clock is the frozen DST sim clock (only advances on world step).
      now: () => wallClock.now(),
      timers: ctx.timers,
      harness: {
        mount: async () => {
          const result = render(
            createElement(App, {
              io,
              resources: seams.resources,
            })
          );
          await act(async () => {
            await Promise.resolve();
          });
          // Dual-actor DST parks the inactive actor (close/launch) so only one
          // RNTL tree is mounted — text input works without `embedded`.
          return createRenderedAppFromRntl(result);
        },
      },
    });
    await driver.launch();
    return driver;
  });
}

export function createProductImpls(args: {
  readonly pubSubBus: InMemoryBus;
}): ResourceImpl<unknown, unknown>[] {
  return [apiResource, roomResource, createProductClientResource(args)];
}
