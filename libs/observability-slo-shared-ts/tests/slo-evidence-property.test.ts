import { expect, test } from 'bun:test';
import { indicatorFor } from '@libs/observability-slo-shared-ts/slo-indicators';
import { metricMeasures } from '@libs/observability-slo-shared-ts/slo-live';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { fakeMetrics } from './fake-metrics';

const checks = indicatorFor('game-journeys-passing')?.scope[0]?.values;
if (checks === undefined) throw new Error('Game check inventory is missing');
const names = checks;
const atMs = 1_000_000;

test('a run is healthy only when every required game reports success', async () => {
  await assertProperty(
    'missing and failed game results never borrow successful sibling evidence',
    fc.asyncProperty(
      fc.array(fc.constantFrom('missing', 'pass', 'fail'), {
        minLength: names.length,
        maxLength: names.length,
      }),
      async (outcomes) => {
        const samples = names.flatMap((name, index) =>
          outcomes[index] === 'missing'
            ? []
            : [
                {
                  name: 'synthetic_check_result',
                  environment: 'prd',
                  labels: { app_synthetic_check: name },
                  points: [{ atMs, value: outcomes[index] === 'pass' ? 1 : 0 }],
                },
              ]
        );
        const measure = metricMeasures({
          client: fakeMetrics([], samples),
          environment: 'prd',
          slis: ['game-journeys-passing'],
        })['game-journeys-passing'];
        if (measure === undefined) throw new Error('Missing measurement');
        const result = await measure({
          nowMs: atMs,
          startMs: atMs - 60_000,
          endMs: atMs,
        });
        if (result.kind !== 'events')
          throw new Error('Expected scheduled observations');
        expect(
          result.events.length > 0 && result.events.every((event) => event.good)
        ).toBe(outcomes.every((outcome) => outcome === 'pass'));
      }
    )
  );
});
