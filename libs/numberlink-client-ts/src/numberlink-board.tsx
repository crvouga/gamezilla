import { connectedPairs } from '@libs/numberlink-shared-ts/numberlink-state';
import type {
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { useLingui } from '@lingui/solid/macro';
import {
  PathGridBoard,
  type PathGridBoardProps,
} from '@pkgs/ui-root-client-ts/path-grid-board';
import { createMemo, type JSX } from 'solid-js';

type NumberlinkBoardProps = Pick<
  PathGridBoardProps,
  | 'disabled'
  | 'selectedCell'
  | 'onActivate'
  | 'onNavigate'
  | 'onCellKey'
  | 'onTraceStart'
  | 'onTraceMove'
  | 'onTraceEnd'
  | 'onTraceCancel'
> & {
  readonly definition: NumberlinkDefinition;
  readonly state: NumberlinkState;
};

function pairColor(definition: NumberlinkDefinition, id: string) {
  const pair = definition.pairs.find((entry) => entry.id === id);
  if (pair === undefined)
    throw new Error('A validated path must name an endpoint pair');
  return pair.color;
}

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

type CellOwner = {
  readonly pair: NumberlinkDefinition['pairs'][number];
  readonly endpoint: boolean;
};

export function NumberlinkBoard(props: NumberlinkBoardProps): JSX.Element {
  const { t } = useLingui();
  // Equal membership keeps endpoints and statuses still while a path grows.
  const connected = createMemo(
    () => new Set(connectedPairs(props.definition, props.state)),
    new Set<string>(),
    { equals: sameMembers }
  );
  const endpoints = createMemo(() =>
    props.definition.pairs.flatMap((pair) =>
      pair.endpoints.map((cell) => ({
        cell: cell.y * props.definition.width + cell.x,
        label: pair.label,
        tone: pair.color,
        connected: connected().has(pair.id),
      }))
    )
  );
  const lines = createMemo(() =>
    props.state.paths.map((path) => ({
      id: path.pairId,
      tone: pairColor(props.definition, path.pairId),
      connected: connected().has(path.pairId),
      cells: path.cells.map((cell) => cell.y * props.definition.width + cell.x),
    }))
  );
  // One pass per drawing step, so each of a dense board's cells labels
  // itself by lookup instead of searching every pair and path.
  const owners = createMemo(() => {
    const width = props.definition.width;
    const byId = new Map(props.definition.pairs.map((pair) => [pair.id, pair]));
    const result = new Map<number, CellOwner>();
    for (const path of props.state.paths) {
      const pair = byId.get(path.pairId);
      if (pair === undefined) continue;
      for (const cell of path.cells)
        result.set(cell.y * width + cell.x, { pair, endpoint: false });
    }
    for (const pair of props.definition.pairs)
      for (const end of pair.endpoints)
        result.set(end.y * width + end.x, { pair, endpoint: true });
    return result;
  });
  const label = (index: number): string => {
    const x = index % props.definition.width;
    const y = Math.floor(index / props.definition.width);
    const coordinate = `${String.fromCharCode(65 + x)}${y + 1}`;
    const owner = owners().get(index);
    if (owner === undefined) return t`${coordinate}: empty`;
    const { pair } = owner;
    const status = connected().has(pair.id) ? t`connected` : t`unfinished`;
    return owner.endpoint
      ? t`${coordinate}: endpoint ${pair.label}, ${status}`
      : t`${coordinate}: path ${pair.label}, ${status}`;
  };
  return (
    <PathGridBoard
      columns={props.definition.width}
      rows={props.definition.height}
      label={t`Numberlink board`}
      testId="numberlink-board"
      endpoints={endpoints()}
      lines={lines()}
      cellLabel={label}
      disabled={props.disabled}
      selectedCell={props.selectedCell}
      onActivate={props.onActivate}
      onNavigate={props.onNavigate}
      onCellKey={props.onCellKey}
      onTraceStart={props.onTraceStart}
      onTraceMove={props.onTraceMove}
      onTraceEnd={props.onTraceEnd}
      onTraceCancel={props.onTraceCancel}
    />
  );
}
