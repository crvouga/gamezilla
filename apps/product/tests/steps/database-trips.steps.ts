// @io-wall-ok — live health: the deployed app's own trace of one request.
/** `specs/runtime/serving-people.feature` (skipped with `OBSERVABILITY_ENABLED=0`). */

import { expect } from 'bun:test';
import {
  readDatabaseOpenMs,
  requestDatabaseTrace,
} from '@libs/observability-server/app-trace-probe';
import { ObservabilitySecretName as Name } from '@libs/observability-shared/secret-names';
import { wallClock } from '@pkgs/clock-shared/wall';
import { eventually, Then } from './define';
import { requireSecret } from './live-world';
import { wallWait } from './wall-wait';

/**
 * The API runs beside its database (`databasePlacement` in
 * `libs/infra-shared/src/wrangler.ts`), where opening a connection costs
 * a local handshake and a few short round trips: about 15 ms. From across the
 * country the same span measured 112 to 194 ms in Deploy's traces. 60 ms is
 * four times what a placed Worker needs and about half of the least a distant
 * one took, so it passes ordinary jitter and fails a Worker that is not beside
 * its data. The release journeys model that hop; this is the one place the
 * claim meets the deployed environment.
 */
export const REACH_DATABASE_MS_LIMIT = 60;
/** The quickest of a few, so one cold start does not decide it. */
const PROBES = 3;
const TRACE_WAIT_MS = 3 * 60 * 1000;
const RETRY_MS = 10_000;

function newProbe() {
  return {
    traceId: crypto.randomUUID().replaceAll('-', ''),
    spanId: crypto.randomUUID().replaceAll('-', '').slice(0, 16),
  };
}

Then(
  'the app brings up what people saved without keeping them waiting',
  async (w) => {
    const probes = Array.from({ length: PROBES }, newProbe);
    for (const probe of probes)
      expect(
        await requestDatabaseTrace(w.http, w.origins.api, probe),
        'the app could not answer the request that needs what people saved'
      ).toBe(true);
    const reached = new Map<string, number>();
    const readable = await eventually(
      async () => {
        for (const probe of probes) {
          if (reached.has(probe.traceId)) continue;
          const ms = await readDatabaseOpenMs(w.http, {
            probe,
            tempoUrl: requireSecret(Name.tempoUrl),
            tempoUser: requireSecret(Name.tempoUser),
            tempoToken: requireSecret(Name.tempoToken),
            nowMs: wallClock.now(),
          });
          if (ms !== null) reached.set(probe.traceId, ms);
        }
        return reached.size === probes.length;
      },
      { maxWaitMs: TRACE_WAIT_MS, retryMs: RETRY_MS, ...wallWait }
    );
    expect(
      readable,
      'the requests were answered but their trips to what people saved never became readable'
    ).toBe(true);
    const times = [...reached.values()];
    expect(
      Math.min(...times),
      `reaching what people saved takes this long at best (ms); the app is not beside it. All: ${JSON.stringify(times.map(Math.round))}`
    ).toBeLessThanOrEqual(REACH_DATABASE_MS_LIMIT);
  }
);
