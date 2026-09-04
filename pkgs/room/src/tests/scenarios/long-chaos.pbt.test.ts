import { describe, expect, test } from 'bun:test';

import { clientHash, serverHash } from '../../sim/scenario';
import { counterSystem } from '../apps/counter/system';
import { expectConverged } from '../expect-converged';

type Fingerprint = {
  readonly choices: string;
  readonly hashes: string;
};

/** One seeded walk over the full pool, healed and converged at the end. */
async function walkFingerprint(
  seed: number,
  steps: number
): Promise<Fingerprint> {
  await using s = await counterSystem.script({
    seed,
    args: { clientCount: 2 },
  });
  const w = await s.walk({
    steps,
    time: { weight: 1, minMs: 1, maxMs: 40 },
  });
  await expectConverged(s);
  const hashes = await s.observe(clientHash);
  return {
    choices: JSON.stringify(w.choices),
    hashes: [await s.observe(serverHash), ...Object.values(hashes)].join(':'),
  };
}

describe('room seeded chaos PBT', () => {
  test('same seed → identical walk choices and converged hashes', async () => {
    const once = await walkFingerprint(4242, 24);
    const twice = await walkFingerprint(4242, 24);
    expect(once).toEqual(twice);
  }, 180_000);

  test('full pool explore converges under the registered properties', async () => {
    const report = await counterSystem.explore({
      seed: 61,
      episodes: 6,
      steps: 20,
      args: { clientCount: 2 },
      time: { weight: 1, minMs: 1, maxMs: 40 },
    });
    expect(report.ok).toBe(true);
  }, 180_000);
});
