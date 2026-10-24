import { expect, test } from 'bun:test';
import { newQuoridor, wallRefusal } from '@libs/quoridor-shared-ts/quoridor';
import {
  QUORIDOR_DIRECTIONS,
  quoridorConnected,
  quoridorNeighbor,
} from '@libs/quoridor-shared-ts/quoridor-geometry';

const WITNESSES = ['c3h', 'f3h', 'c6h', 'f6h'];

function* wallLayouts(): Generator<readonly string[]> {
  const anchors: string[] = [];
  for (const column of 'abcdefgh')
    for (const row of '12345678')
      for (const orientation of ['h', 'v'])
        anchors.push(`${column}${row}${orientation}`);
  yield [];
  for (const anchor of anchors) yield [anchor];
  for (let first = 0; first < anchors.length; first++)
    for (let second = first; second < anchors.length; second++)
      yield [anchors[first]!, anchors[second]!];
}

function floodComponent(
  walls: readonly string[],
  labels: Int16Array,
  start: number
) {
  const queue = [start];
  labels[start] = start;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const [dx, dy] of QUORIDOR_DIRECTIONS) {
      const next = quoridorNeighbor(cell, dx, dy);
      if (
        next === null ||
        labels[next] !== -1 ||
        !quoridorConnected(walls, cell, next)
      )
        continue;
      labels[next] = start;
      queue.push(next);
    }
  }
}

/** Every square is labelled by the smallest square in its full component. */
function components(walls: readonly string[]) {
  const labels = new Int16Array(81).fill(-1);
  for (let cell = 0; cell < 81; cell++)
    if (labels[cell] === -1) floodComponent(walls, labels, cell);
  return labels;
}

test('with at most two walls a central witness preserves every connected component', () => {
  let layouts = 0;
  let witnesses = 0;
  for (const walls of wallLayouts()) {
    const before = components(walls);
    const game = { ...newQuoridor('hill'), walls };
    let legal = 0;
    for (const candidate of WITNESSES) {
      // All four preserve the graph, even when the existing walls conflict
      // with each other or the candidate overlaps/crosses an existing wall.
      expect({
        walls,
        candidate,
        components: components([...walls, candidate]),
      }).toEqual({ walls, candidate, components: before });
      const refusal = wallRefusal(game, candidate);
      expect([null, 'overlap', 'crossing']).toContain(refusal);
      if (refusal === null) legal++;
      witnesses++;
    }
    expect(legal).toBeGreaterThanOrEqual(2);
    layouts++;
  }
  expect(layouts).toBe(8_385);
  expect(witnesses).toBe(33_540);
});
