import {
  moveOnToNextPuzzle,
  readPuzzleOnBoard,
  skipGamePuzzle,
} from '@libs/game-session-harness-ts/puzzle-screen';
import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { playUntilSolved } from './chess-actions';
import { readLocalPuzzles } from './chess-puzzle-data';

const PASSES = new WeakMap<ProductHarness, Map<string, readonly string[]>>();

/** A deterministic pass through the scenario's finite pool, keeping its rating near the pool. */
export const playPuzzleFeedPass = scenarioAction({
  name: 'playPuzzleFeedPass',
  act: async (s, actor: string, expected: readonly string[]) => {
    await pollUntil(
      s,
      async () => {
        const local = new Set(
          (await readLocalPuzzles(s, actor)).map((p) => p.id)
        );
        return expected.every((id) => local.has(id)) ? true : null;
      },
      {
        maxMs: 30_000,
        description: 'the complete puzzle pool has reached the device',
      }
    );
    const served: string[] = [];
    for (const [index] of expected.entries()) {
      const id = await readPuzzleOnBoard(s, actor);
      if (id === null) throw new Error('No puzzle was served');
      served.push(id);
      await Promise.resolve(
        (index % 2 === 0 ? playUntilSolved : skipGamePuzzle).act(s, actor)
      );
      await Promise.resolve(moveOnToNextPuzzle.act(s, actor));
    }
    const passes = PASSES.get(s) ?? new Map<string, readonly string[]>();
    passes.set(actor, served);
    PASSES.set(s, passes);
  },
});

export function readPuzzleFeedPass(s: ProductHarness, actor: string) {
  return PASSES.get(s)?.get(actor) ?? [];
}

export function readExcludedFeedPassPuzzles(
  s: ProductHarness,
  actor: string,
  excluded: readonly string[]
) {
  return readPuzzleFeedPass(s, actor).filter((id) => excluded.includes(id));
}
