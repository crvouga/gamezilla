import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { collectDiagnostics } from '@pkgs/feedback-shared-ts/diagnostics';

// regression: feedback-optional-context-budget
test('details that together pass the budget are marked missing, not sent', async () => {
  const { timers } = createHarnessClock();
  const details = await collectDiagnostics(
    [
      { name: 'small', collect: () => ({ ok: true }) },
      { name: 'wide', collect: () => 'é'.repeat(400) },
      { name: 'after', collect: () => ({ ok: true }) },
    ],
    timers,
    1000,
    500
  );
  expect(details).toEqual([
    { name: 'small', status: 'available', value: { ok: true } },
    {
      name: 'wide',
      status: 'unavailable',
      reason: 'Diagnostic budget exceeded',
    },
    { name: 'after', status: 'available', value: { ok: true } },
  ]);
});

test('a detail that never answers is given up on at the deadline', async () => {
  const { clock, timers } = createHarnessClock();
  let cancelled = false;
  const collecting = collectDiagnostics(
    [
      {
        name: 'stuck',
        collect: (signal) => {
          signal.addEventListener('abort', () => {
            cancelled = true;
          });
          return new Promise(() => undefined);
        },
      },
      { name: 'quick', collect: () => 1 },
    ],
    timers,
    1500
  );
  // Long enough for the quick detail to answer, with no time passing.
  await new Promise((resolve) => setImmediate(resolve));
  clock.advance(1500);
  expect(await collecting).toEqual([
    { name: 'stuck', status: 'unavailable', reason: 'Timed out' },
    { name: 'quick', status: 'available', value: 1 },
  ]);
  expect(cancelled).toBe(true);
});

test('a detail that fails or cannot be written down is marked missing', async () => {
  const { timers } = createHarnessClock();
  const circular: Record<string, unknown> = {};
  circular['self'] = circular;
  const details = await collectDiagnostics(
    [
      {
        name: 'throws',
        collect: () => {
          throw new Error('no');
        },
      },
      { name: 'circular', collect: () => circular },
      { name: 'nothing', collect: () => undefined },
    ],
    timers,
    1000
  );
  expect(details.map((detail) => detail.status)).toEqual([
    'unavailable',
    'unavailable',
    'unavailable',
  ]);
});
