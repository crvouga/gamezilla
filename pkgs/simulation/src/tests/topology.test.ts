import { describe, expect, test } from 'bun:test';

import { defineTopology, kindHasHtml } from '../topology';

describe('defineTopology', () => {
  test('freezes a valid topology', () => {
    const topology = defineTopology({
      kinds: {
        client: { attributes: ['html', 'sqlite'] },
        server: { attributes: ['sqlite'] },
      },
      nodes: [{ id: 'server', kind: 'server' }],
      edges: [],
      spawn: {
        client: { edges: [{ to: 'server', kind: 'http' }] },
      },
    });
    expect(topology.nodes).toHaveLength(1);
    expect(kindHasHtml(topology, 'client')).toBe(true);
    expect(kindHasHtml(topology, 'server')).toBe(false);
  });

  test('rejects unknown kind on node', () => {
    expect(() =>
      defineTopology({
        kinds: { server: { attributes: ['sqlite'] } },
        nodes: [{ id: 'x', kind: 'client' }],
      })
    ).toThrow(/unknown kind/);
  });

  test('rejects spawn edge to unknown node', () => {
    expect(() =>
      defineTopology({
        kinds: {
          client: { attributes: ['html'] },
          server: { attributes: ['sqlite'] },
        },
        nodes: [],
        spawn: {
          client: { edges: [{ to: 'server', kind: 'http' }] },
        },
      })
    ).toThrow(/unknown node/);
  });
});
