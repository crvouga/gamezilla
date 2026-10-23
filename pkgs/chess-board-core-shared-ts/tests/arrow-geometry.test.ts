import { describe, expect, test } from 'bun:test';
import {
  arrowDashArray,
  arrowGeometry,
  arrowSvgPaths,
  arrowThicknessPx,
  boardArrowGeometry,
  knightCorner,
} from '@pkgs/chess-board-core-shared-ts/arrow-geometry';

const BOARD = 320; // cell = 40

describe('arrowThicknessPx', () => {
  test('fraction of cell with a 3px floor', () => {
    expect(arrowThicknessPx(40)).toBeCloseTo(5.6);
    expect(arrowThicknessPx(40, 0.5)).toBe(20);
    expect(arrowThicknessPx(4, 0.1)).toBe(3);
  });
});

describe('arrowGeometry', () => {
  test('straight arrow runs between square centers, head flush with target', () => {
    const g = arrowGeometry({
      from: 'e2',
      to: 'e4',
      boardPx: BOARD,
      orientation: 'white',
      thickness: 5,
    });
    // e2 center (white): col 4 → x=180; rank 2 → row 6 → y=260. e4 → y=180.
    expect(g.shaft[0]).toEqual({ x: 180, y: 260 });
    const [tip] = g.head;
    expect(tip).toEqual({ x: 180, y: 180 });
    // Head length = max(5*2.4, 14) = 14 → shaft ends 14px short of tip.
    expect(g.shaft[1]).toEqual({ x: 180, y: 194 });
    expect(g.shaft).toHaveLength(2);
    expect(g.thickness).toBe(5);
  });

  test('black orientation mirrors both axes', () => {
    const g = arrowGeometry({
      from: 'e2',
      to: 'e4',
      boardPx: BOARD,
      orientation: 'black',
      thickness: 5,
    });
    expect(g.shaft[0]).toEqual({ x: 140, y: 60 });
    expect(g.head[0]).toEqual({ x: 140, y: 140 });
  });

  test('knight jump bends into an L with the corner on the long leg', () => {
    const g = arrowGeometry({
      from: 'g1',
      to: 'f3',
      boardPx: BOARD,
      orientation: 'white',
      thickness: 5,
    });
    expect(g.shaft).toHaveLength(3);
    // g1 = (260, 300); f3 = (220, 220). Long leg is vertical → corner (260, 220).
    expect(g.shaft[0]).toEqual({ x: 260, y: 300 });
    expect(g.shaft[1]).toEqual({ x: 260, y: 220 });
    expect(g.head[0]).toEqual({ x: 220, y: 220 });
  });

  test('explicit knight=false forces a straight arrow', () => {
    const g = arrowGeometry({
      from: 'g1',
      to: 'f3',
      boardPx: BOARD,
      orientation: 'white',
      thickness: 5,
      knight: false,
    });
    expect(g.shaft).toHaveLength(2);
  });

  test('head base corners are symmetric about the shaft axis', () => {
    const g = arrowGeometry({
      from: 'a1',
      to: 'h8',
      boardPx: BOARD,
      orientation: 'white',
      thickness: 10,
    });
    const [tip, l, r] = g.head;
    const mid = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
    const base = g.shaft[g.shaft.length - 1];
    if (base === undefined) throw new Error('missing shaft end');
    expect(mid.x).toBeCloseTo(base.x);
    expect(mid.y).toBeCloseTo(base.y);
    // Half width = max(10*1.6, 9) = 16.
    expect(Math.hypot(l.x - r.x, l.y - r.y)).toBeCloseTo(32);
    expect(Math.hypot(tip.x - base.x, tip.y - base.y)).toBeCloseTo(24);
  });
});

describe('knightCorner', () => {
  test('vertical long leg keeps x, horizontal keeps y', () => {
    expect(knightCorner({ x: 0, y: 0 }, { x: 1, y: 2 })).toEqual({
      x: 0,
      y: 2,
    });
    expect(knightCorner({ x: 0, y: 0 }, { x: 2, y: 1 })).toEqual({
      x: 2,
      y: 0,
    });
  });
});

describe('boardArrowGeometry + arrowSvgPaths', () => {
  test('derives thickness from the arrow and emits SVG path data', () => {
    const g = boardArrowGeometry(
      { from: 'e2', to: 'e4', thickness: 0.25 },
      BOARD,
      'white'
    );
    expect(g.thickness).toBe(10);
    const { shaftD, headD } = arrowSvgPaths(g);
    expect(shaftD).toBe('M180 260 L180 204');
    expect(headD).toBe('M180 180 L196 204 L164 204 Z');
  });

  test('dash array scales with thickness', () => {
    expect(arrowDashArray(10)).toEqual([16, 12]);
  });
});
