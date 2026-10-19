import { expect } from 'bun:test';
import { multiplayerText } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { openFindingAnOpponent } from '@libs/game-matchmaking-harness/opponent-seeking';
import { readCustomGameAlert } from '@libs/game-session-harness/custom-game-reads';
import { Then } from '@libs/harness/define';
import { toldOf } from './custom-game-set-up-world';
import { gameOf } from './game-world';

Then('{actor} is told {actor} cannot be invited', async (w, actor: string) =>
  toldOf(w, actor, 'cannot be invited')
);
Then(
  '{actor} is told that side is not available to him',
  async (w, actor: string) => toldOf(w, actor, 'side not available')
);
// What a custom game tells him, or what his search for an opponent shows.
Then(
  '{actor} is not told {actor} blocked him',
  async (w, actor: string, blocker: string) => {
    const alert = await w.s.read(readCustomGameAlert, actor);
    if (alert === null)
      await w.s.apply(openFindingAnOpponent, actor, gameOf(w).shared.id);
    const told = (
      alert ?? (await w.s.read(multiplayerText, actor, 'multiplayer-waiting'))
    )?.toLowerCase();
    expect(told).toBeString();
    expect(told).not.toBe('');
    expect(told).not.toContain('block');
    expect(told).not.toContain(blocker);
  }
);
