import { expect, test } from 'bun:test';
import {
  parseReleasePart,
  splitReleaseSpecs,
} from '../scripts/release-selection';

const WEIGHTS: Record<string, number> = {
  'specs/journeys/numberlink-packs.feature': 4,
  'specs/journeys/custom-game.feature': 4,
  'specs/journeys/join-and-offline.feature': 3,
  'specs/journeys/multiplayer-game.feature': 3,
  'specs/journeys/sokoban-packs.feature': 3,
  'specs/journeys/quoridor-game.feature': 2,
  'specs/quoridor/quoridor-health.feature': 2,
  'specs/journeys/pong-game.feature': 1,
  'specs/battleship/battleship-health.feature': 1,
};
const SPECS = Object.keys(WEIGHTS);
const weigh = (spec: string) => WEIGHTS[spec] ?? 1;

// regression: release-journeys-outran-task-budget
test('every release spec runs in exactly one part, the same way on every machine', () => {
  const shares = splitReleaseSpecs(SPECS, 3, weigh);
  expect(shares).toHaveLength(3);
  expect(shares.flat().sort()).toEqual([...SPECS].sort());
  expect(splitReleaseSpecs([...SPECS].reverse(), 3, weigh)).toEqual(shares);
});

test('the parts weigh about the same, and the two heaviest features never share one', () => {
  const shares = splitReleaseSpecs(SPECS, 3, weigh);
  const weights = shares.map((share) =>
    share.reduce((sum, spec) => sum + weigh(spec), 0)
  );
  expect(Math.max(...weights) - Math.min(...weights)).toBeLessThanOrEqual(1);
  const holding = (spec: string) => shares.findIndex((s) => s.includes(spec));
  expect(holding('specs/journeys/numberlink-packs.feature')).not.toBe(
    holding('specs/journeys/custom-game.feature')
  );
});

test('a feature with no scenarios still counts, and fewer specs than parts leaves empty parts', () => {
  expect(splitReleaseSpecs(['a.feature', 'b.feature'], 3, () => 0)).toEqual([
    ['a.feature'],
    ['b.feature'],
    [],
  ]);
});

test('--part=<k>/<n> selects a share, and an impossible one is refused', () => {
  expect(parseReleasePart(['--tags', 'x', '--part=2/3'])).toEqual({
    part: 2,
    parts: 3,
  });
  expect(parseReleasePart(['specs/journeys/pong-game.feature'])).toBeNull();
  expect(() => parseReleasePart(['--part=3/3'])).toThrow();
  expect(() => parseReleasePart(['--part=0/0'])).toThrow();
});
