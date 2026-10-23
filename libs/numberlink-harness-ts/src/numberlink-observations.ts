import {
  connectedPairs,
  numberlinkComplete,
} from '@libs/numberlink-shared-ts/numberlink-state';
import { namedCells } from './numberlink-fixtures';
import type { NumberlinkHarness } from './numberlink-system';

export function numberlinkPath(
  s: NumberlinkHarness,
  label: string
): string | null {
  const id = s.definition.pairs.find((pair) => pair.label === label)?.id;
  const path = s.state.paths.find((entry) => entry.pairId === id);
  return path === undefined ? null : namedCells(path.cells);
}

export function numberlinkPairConnected(
  s: NumberlinkHarness,
  label: string
): boolean {
  const id = s.definition.pairs.find((pair) => pair.label === label)?.id;
  return id !== undefined && connectedPairs(s.definition, s.state).includes(id);
}

export function numberlinkStatus(s: NumberlinkHarness): {
  readonly complete: boolean;
  readonly uncovered: number;
  readonly pairsConnected: number;
  readonly pairsTotal: number;
} {
  return {
    complete: numberlinkComplete(s.definition, s.state),
    uncovered:
      s.definition.width * s.definition.height -
      s.state.paths.reduce((total, path) => total + path.cells.length, 0),
    pairsConnected: connectedPairs(s.definition, s.state).length,
    pairsTotal: s.definition.pairs.length,
  };
}

export const numberlinkRefusal = (s: NumberlinkHarness): string | null =>
  s.refusal;
export const numberlinkPathsUnchanged = (s: NumberlinkHarness): boolean =>
  JSON.stringify(s.state) === s.before;
export const numberlinkDefinitionUnchanged = (s: NumberlinkHarness): boolean =>
  JSON.stringify(s.definition) === s.original;
export const numberlinkEmpty = (s: NumberlinkHarness): boolean =>
  s.state.paths.length === 0;
