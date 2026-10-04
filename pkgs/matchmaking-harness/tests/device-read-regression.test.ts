import { expect, test } from 'bun:test';
import { deviceView } from '@pkgs/matchmaking-harness/devices';
import { connectDevice, waitForMatch } from '@pkgs/matchmaking-harness/lobby';
import { matchmaking } from '@pkgs/matchmaking-harness/system';

// regression: matchmaking-concurrent-device-reads
test('Alice begins after all eight connected devices open their current views', async () => {
  await using s = await matchmaking.run({
    seed: 'eight-device-reads',
    args: { replicas: 3 },
  });
  for (const person of ['alice', 'bob', 'carol', 'dave']) {
    for (const place of ['phone', 'computer'])
      await s.apply(connectDevice, { person, place, connected: true });
  }
  await s.apply(waitForMatch, {
    person: 'alice',
    place: 'phone',
    rating: 1000,
    range: 200,
    groupSize: 4,
  });
  const phone = await s.read(deviceView, { person: 'alice', place: 'phone' });
  const computer = await s.read(deviceView, {
    person: 'alice',
    place: 'computer',
  });
  expect(phone?.result?.status).toBe('waiting');
  expect(computer).toEqual(phone);
});
