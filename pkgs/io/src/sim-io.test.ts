import { describe, expect, test } from 'bun:test';

import { createSimIo } from './sim-io';

describe('createSimIo', () => {
  test('same seed yields the same id and random stream', () => {
    const a = createSimIo({ seed: 7 });
    const b = createSimIo({ seed: 7 });
    expect(a.createId()).toBe(b.createId());
    expect(a.random()).toBe(b.random());
    expect(a.seed).toBe(b.seed);
  });

  test('clock advance fires setTimeout', () => {
    const io = createSimIo({ seed: 1, startMs: 0 });
    let hit = 0;
    io.timers.setTimeout(() => {
      hit += 1;
    }, 100);
    expect(hit).toBe(0);
    io.clock.advance(99);
    expect(hit).toBe(0);
    io.clock.advance(1);
    expect(hit).toBe(1);
  });

  test('http rejects by default', async () => {
    const io = createSimIo({ seed: 1 });
    await expect(io.http.fetch('https://example.com')).rejects.toThrow(
      /http not configured/
    );
  });
});
