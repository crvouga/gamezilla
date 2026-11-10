import { expect, test } from 'bun:test';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

test('pausing and resuming every Synthetic User changes all of them once per operation', async () => {
  const f = await syntheticPopulationFixture(2);
  try {
    const first = (await f.controller.claim(f.workers[0]!))!;
    const second = (await f.controller.claim(f.workers[1]!))!;
    const actor = f.createId();
    const pause = { operationId: f.createId(), command: 'pause-all' } as const;
    expect(await f.admin.commandAll(pause, actor)).toBe(true);
    const paused = await f.repo.users();
    expect(paused.map((user) => user.paused)).toEqual([true, true]);
    // A retried request is the same command, not another one.
    expect(await f.admin.commandAll(pause, actor)).toBe(true);
    expect(await f.admin.commandAll(pause, f.createId())).toBe(false);
    for (const lease of [first.lease, second.lease])
      expect((await f.sessions.renew(lease))?.paused).toBe(true);
    const resume = {
      operationId: f.createId(),
      command: 'resume-all',
    } as const;
    expect(await f.admin.commandAll(resume, actor)).toBe(true);
    expect((await f.repo.users()).map((user) => user.paused)).toEqual([
      false,
      false,
    ]);
    // Workers never receive a bulk command as one of their own to complete.
    expect((await f.sessions.renew(first.lease))?.commands).toEqual([]);
  } finally {
    await f.db.disconnect();
  }
});
