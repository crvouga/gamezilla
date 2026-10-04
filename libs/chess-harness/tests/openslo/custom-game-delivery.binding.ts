import { readCustomGameTime } from '@libs/chess-custom-game-harness/custom-game-clocks';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import type { Measurement } from '@pkgs/openslo-shared/evaluate';
import type { MeasureContext } from '@pkgs/openslo-shared/registry';
import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { openHarness } from '../open-chess-harness';
import { customDefault, customFact } from '../steps/custom-game-world';

/** Accepted choices, measured on the harness clock at the receiving screen. */
async function arrivals(context: MeasureContext): Promise<Measurement> {
  await using s = await openHarness('custom-game-choice-arrivals');
  const w = { s, memo: new Map<string, unknown>() };
  await customDefault(w, 'alice');
  const samples: { atMs: number; value: number }[] = [];
  for (let index = 0; index < 100; index += 1) {
    const increment = index % 2 === 0 ? 2 : 0;
    // Include acknowledgement time so settling the writer cannot hide delivery.
    const chosenAtMs = await s.read(readCustomGameTime);
    await customFact(w, 'alice', {
      operation: 'clock',
      minutes: 1,
      increment,
    });
    const revision = (await s.read(readCustomGameProbe, 'alice'))?.current
      ?.revision;
    if (revision === undefined) throw new Error('Accepted choice has no game');
    let elapsed = 0;
    for (;;) {
      elapsed = (await s.read(readCustomGameTime)) - chosenAtMs;
      const received = (await s.read(readCustomGameProbe, 'bob'))?.current;
      if (
        received?.revision === revision &&
        received.minutes === 1 &&
        received.increment === increment
      )
        break;
      if (elapsed >= 10_000) break;
      await s.advanceTime(5);
    }
    samples.push({ atMs: chosenAtMs, value: elapsed / 1000 });
  }
  const endedAtMs = await s.read(readCustomGameTime);
  return {
    kind: 'samples',
    samples: samples.map((sample) => ({
      atMs: context.endMs - (endedAtMs - sample.atMs),
      value: sample.value,
    })),
  };
}

bindObjectives({
  spec: 'custom-game-delivery',
  measure: { 'custom-game-choice-arrival': arrivals },
  nowMs: () => Date.UTC(2026, 8, 28, 12),
});
