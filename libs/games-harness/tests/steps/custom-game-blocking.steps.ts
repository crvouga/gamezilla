import { expect } from 'bun:test';
import { readCustomGameAlert } from '@libs/game-session-harness/custom-game-reads';
import { Then } from '@libs/harness/define';
import { toldOf } from './custom-game-set-up-world';

Then('{actor} is told {actor} cannot be invited', async (w, actor: string) =>
  toldOf(w, actor, 'cannot be invited')
);
Then(
  '{actor} is told that side is not available to him',
  async (w, actor: string) => toldOf(w, actor, 'side not available')
);
Then(
  '{actor} is not told {actor} blocked him',
  async (w, actor: string, blocker: string) => {
    const told = (await w.s.read(readCustomGameAlert, actor))?.toLowerCase();
    expect(told).toBeString();
    expect(told).not.toBe('');
    expect(told).not.toContain('block');
    expect(told).not.toContain(blocker);
  }
);
