import type { CellGridEdge } from '@pkgs/ui-root-client-ts/cell-grid-board';

/** The sides exposed to water, including where two separate ships touch. */
export function hullEdges(
  cells: readonly string[],
  cell: string
): readonly CellGridEdge[] {
  const across = cells[0]?.slice(1) === cells.at(-1)?.slice(1);
  const edges: CellGridEdge[] = across ? ['top', 'bottom'] : ['left', 'right'];
  if (cell === cells[0]) edges.push(across ? 'left' : 'top');
  if (cell === cells.at(-1)) edges.push(across ? 'right' : 'bottom');
  return edges;
}
