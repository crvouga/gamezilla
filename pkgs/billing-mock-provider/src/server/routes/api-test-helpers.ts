/**
 * Test-mode helpers, behind the same secret key as the API: move a
 * customer's test clock (Stripe's test clocks) and resend an event (Stripe's
 * "resend"). They drive the provider through time without touching the
 * provider's own clock or any other customer.
 */
import { MOCK_BILLING_PATHS } from '@pkgs/billing-mock/wire';
import { Hono } from 'hono';

import { settleCustomer } from '../engine/billing-cycle';
import { customerNowS } from '../engine/context';
import { requireCustomer } from '../engine/customers';
import { invalidRequest, resourceMissing } from '../errors';
import { page } from './list';
import {
  answer,
  optionalInteger,
  optionalString,
  readBody,
  readQuery,
} from './request';
import type { ProviderRunner } from './runner';

export function apiTestHelperRoutes(runner: ProviderRunner): Hono {
  return new Hono()
    .post('/v1/test_helpers/customers/:id/advance_clock', async (c) =>
      answer(c, async () => {
        const frozen = optionalInteger(await readBody(c), 'frozen_time');
        if (frozen === undefined) {
          throw invalidRequest(
            'frozen_time must be unix seconds.',
            'frozen_time'
          );
        }
        const id = c.req.param('id');
        return await runner.run(async (engine) => {
          await requireCustomer(engine, id);
          const nowS = await customerNowS(engine, id);
          if (frozen < nowS) {
            throw invalidRequest(
              'A test clock only moves forward.',
              'frozen_time'
            );
          }
          const offsetMs = frozen * 1000 - engine.deps.clock.now();
          await engine.db.setClockOffsetMs(id, offsetMs);
          await settleCustomer(engine, id);
          return await requireCustomer(engine, id);
        });
      })
    )
    .get(MOCK_BILLING_PATHS.events, async (c) =>
      answer(c, () =>
        runner.run(async (engine) => {
          const query = readQuery(c);
          const events = await engine.db.events(
            optionalString(query, 'type') ?? null
          );
          return page(MOCK_BILLING_PATHS.events, events, query);
        })
      )
    )
    .get('/v1/events/:id', async (c) =>
      answer(c, () =>
        runner.run(async (engine) => {
          const event = await engine.db.event(c.req.param('id'));
          if (event === null) throw resourceMissing('event', c.req.param('id'));
          return event;
        })
      )
    )
    .post('/v1/test_helpers/events/:id/resend', async (c) =>
      answer(c, () =>
        runner.run(async (engine) => {
          const id = c.req.param('id');
          const event = await engine.db.event(id);
          if (event === null) throw resourceMissing('event', id);
          await engine.db.recordAttempt({
            id,
            delivery: 'pending',
            attempts: 0,
            nextAttemptMs: engine.deps.clock.now(),
          });
          return event;
        })
      )
    );
}
