import { endpointOwners } from './numberlink-path-validation';
import {
  type Cell,
  cellKey,
  type EndpointPair,
  type NumberlinkDefinition,
  type NumberlinkPath,
  type NumberlinkState,
  neighbors,
  sameCell,
} from './numberlink-types';

export type Search = {
  readonly definition: NumberlinkDefinition;
  readonly pairs: readonly EndpointPair[];
  readonly endpoints: ReadonlyMap<string, string>;
  readonly occupied: Set<string>;
  readonly solutions: NumberlinkState[];
  readonly maxNodes: number;
  readonly maxSolutions: number;
  nodes: number;
  exhausted: boolean;
};

export function createSearch(
  definition: NumberlinkDefinition,
  maxNodes: number,
  maxSolutions: number
): Search {
  return {
    definition,
    maxNodes,
    maxSolutions,
    pairs: [...definition.pairs].sort((a, b) => distance(a) - distance(b)),
    endpoints: endpointOwners(definition),
    occupied: new Set(),
    solutions: [],
    nodes: 0,
    exhausted: false,
  };
}

function distance(pair: EndpointPair): number {
  const [a, b] = pair.endpoints;
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function searchPairs(
  search: Search,
  paths: readonly NumberlinkPath[]
): void {
  if (search.exhausted || search.solutions.length >= search.maxSolutions)
    return;
  const pair = search.pairs[paths.length];
  if (pair === undefined) {
    if (
      search.definition.coverage === 'pairs' ||
      search.occupied.size ===
        search.definition.width * search.definition.height
    )
      search.solutions.push({
        paths: paths.map((path) => ({ ...path, cells: [...path.cells] })),
      });
    return;
  }
  if (!remainingReachable(search, paths.length)) return;
  const first = pair.endpoints[0];
  search.occupied.add(cellKey(first));
  walk(search, paths, pair, [first]);
  search.occupied.delete(cellKey(first));
}

function walk(
  search: Search,
  paths: readonly NumberlinkPath[],
  pair: EndpointPair,
  cells: readonly Cell[]
): void {
  if (search.solutions.length >= search.maxSolutions || search.exhausted)
    return;
  if (search.nodes >= search.maxNodes) {
    search.exhausted = true;
    return;
  }
  search.nodes++;
  const current = cells[cells.length - 1]!;
  const target = pair.endpoints[1];
  if (sameCell(current, target)) {
    searchPairs(search, [...paths, { pairId: pair.id, cells }]);
    return;
  }
  for (const next of neighbors(search.definition, current)) {
    const key = cellKey(next);
    const owner = search.endpoints.get(key);
    if (search.occupied.has(key) || (owner !== undefined && owner !== pair.id))
      continue;
    search.occupied.add(key);
    walk(search, paths, pair, [...cells, next]);
    search.occupied.delete(key);
  }
}

/** A route must remain for every unfinished pair, even before enumerating it. */
function remainingReachable(search: Search, start: number): boolean {
  return search.pairs.slice(start).every((pair) => {
    const pending = [pair.endpoints[0]];
    const seen = new Set<string>();
    for (let index = 0; index < pending.length; index++) {
      const cell = pending[index]!;
      if (sameCell(cell, pair.endpoints[1])) return true;
      for (const next of neighbors(search.definition, cell)) {
        const key = cellKey(next);
        const endpoint = search.endpoints.get(key);
        if (
          seen.has(key) ||
          search.occupied.has(key) ||
          (endpoint !== undefined && endpoint !== pair.id)
        )
          continue;
        seen.add(key);
        pending.push(next);
      }
    }
    return false;
  });
}
