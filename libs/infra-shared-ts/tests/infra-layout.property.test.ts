import { describe, expect, test } from 'bun:test';
import type {
  LayoutEdge,
  LayoutNode,
} from '@libs/infra-shared-ts/infra-layout';
import { layoutLayered } from '@libs/infra-shared-ts/infra-layout';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const OPTIONS = { gapX: 40, gapY: 12, pad: 10 };

/** A graph of up to 12 nodes with arbitrary edges, cycles and loops included. */
const graph = fc.integer({ min: 1, max: 12 }).chain((n) =>
  fc.record({
    nodes: fc.constant(
      Array.from(
        { length: n },
        (_, i): LayoutNode => ({
          id: `n${i}`,
          width: 100 + (i % 3) * 20,
          height: 40,
        })
      )
    ),
    edges: fc.array(
      fc.record({
        from: fc.integer({ min: 0, max: n }).map((i) => `n${i}`),
        to: fc.integer({ min: 0, max: n }).map((i) => `n${i}`),
      }),
      { maxLength: 30 }
    ),
  })
);

describe('layered layout', () => {
  test('places every node exactly once, inside the canvas, without overlap', () => {
    assertProperty(
      'places every node once, inside the canvas, without overlap',
      fc.property(graph, ({ nodes, edges }) => {
        const layout = layoutLayered(nodes, edges as LayoutEdge[], OPTIONS);
        expect(layout.nodes.map((n) => n.id).sort()).toEqual(
          nodes.map((n) => n.id).sort()
        );
        for (const a of layout.nodes) {
          expect(a.x).toBeGreaterThanOrEqual(0);
          expect(a.y).toBeGreaterThanOrEqual(0);
          expect(a.x + a.width).toBeLessThanOrEqual(layout.width);
          expect(a.y + a.height).toBeLessThanOrEqual(layout.height);
          for (const b of layout.nodes) {
            if (a.id === b.id) continue;
            const apart =
              a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y;
            expect(apart).toBe(true);
          }
        }
      })
    );
  });

  test('routes each distinct valid edge once and ignores loops and strays', () => {
    assertProperty(
      'routes each distinct valid edge once',
      fc.property(graph, ({ nodes, edges }) => {
        const ids = new Set(nodes.map((n) => n.id));
        const expected = new Set(
          edges
            .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
            .map((e) => `${e.from}>${e.to}`)
        );
        const layout = layoutLayered(nodes, edges as LayoutEdge[], OPTIONS);
        expect(new Set(layout.routes.map((r) => `${r.from}>${r.to}`))).toEqual(
          expected
        );
      })
    );
  });

  test('an acyclic chain flows left to right', () => {
    const nodes = ['a', 'b', 'c'].map((id) => ({ id, width: 100, height: 40 }));
    const layout = layoutLayered(
      nodes,
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
      OPTIONS
    );
    const x = (id: string) => layout.nodes.find((n) => n.id === id)?.x ?? -1;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
  });
});
