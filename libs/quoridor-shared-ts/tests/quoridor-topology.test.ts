import { expect, test } from 'bun:test';
import {
  newQuoridor,
  quoridorDistance,
} from '@libs/quoridor-shared-ts/quoridor';

function wallAnchors(): readonly string[] {
  const walls = [''];
  for (const column of 'abcdefgh')
    for (const row of '12345678')
      for (const orientation of ['h', 'v'])
        walls.push(`${column}${row}${orientation}`);
  return walls;
}

test('a single two-boundary wall cannot disconnect any square from any goal', () => {
  for (const mode of ['classic', 'hill'] as const)
    for (const wall of wallAnchors()) {
      const game = { ...newQuoridor(mode), walls: wall === '' ? [] : [wall] };
      for (let cell = 0; cell < 81; cell++)
        for (const player of mode === 'classic' ? [0, 1] : [0])
          expect(Number.isFinite(quoridorDistance(game, player, cell))).toBe(
            true
          );
    }
});
