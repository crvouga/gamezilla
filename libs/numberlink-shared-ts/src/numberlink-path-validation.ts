import {
  cellKey,
  type EndpointPair,
  inBounds,
  type NumberlinkDefinition,
  type NumberlinkIssue,
  type NumberlinkPath,
  sameCell,
} from './numberlink-types';

type PathContext = {
  readonly definition: NumberlinkDefinition;
  readonly pair: EndpointPair;
  readonly endpoints: ReadonlyMap<string, string>;
  readonly occupied: Set<string>;
};

export function pathIssues(
  path: NumberlinkPath,
  ctx: PathContext
): NumberlinkIssue[] {
  const first = path.cells[0];
  const issues: NumberlinkIssue[] = [];
  if (
    first === undefined ||
    !ctx.pair.endpoints.some((cell) => sameCell(cell, first))
  )
    issues.push({
      code: 'start_at_endpoint',
      message: 'Start a path at one of its matching endpoints.',
      pairId: path.pairId,
    });
  for (const [index, cell] of path.cells.entries()) {
    const code = invalidCell(path, index, ctx);
    if (code !== null) issues.push({ ...code, cell, pairId: path.pairId });
    ctx.occupied.add(cellKey(cell));
  }
  return issues;
}

function invalidCell(
  path: NumberlinkPath,
  index: number,
  ctx: PathContext
): NumberlinkIssue | null {
  const cell = path.cells[index]!;
  if (!inBounds(ctx.definition, cell))
    return { code: 'path_outside', message: 'Keep the path inside the board.' };
  if (ctx.occupied.has(cellKey(cell)))
    return {
      code: 'path_collision',
      message: 'Paths cannot cross, overlap or revisit a cell.',
    };
  const previous = path.cells[index - 1];
  if (
    previous !== undefined &&
    Math.abs(previous.x - cell.x) + Math.abs(previous.y - cell.y) !== 1
  )
    return {
      code: 'path_gap',
      message: 'Join neighboring cells horizontally or vertically.',
    };
  const endpoint = ctx.endpoints.get(cellKey(cell));
  if (endpoint !== undefined && endpoint !== path.pairId)
    return {
      code: 'other_endpoint',
      message: 'This endpoint belongs to another pair.',
    };
  if (endpoint !== undefined && index > 0 && index !== path.cells.length - 1)
    return {
      code: 'past_endpoint',
      message: 'A path stops when it reaches its matching endpoint.',
    };
  return null;
}

export function endpointOwners(
  definition: NumberlinkDefinition
): Map<string, string> {
  return new Map(
    definition.pairs.flatMap((pair) =>
      pair.endpoints.map((cell) => [cellKey(cell), pair.id] as const)
    )
  );
}
