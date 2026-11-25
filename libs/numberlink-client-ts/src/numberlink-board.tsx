import { connectedPairs } from '@libs/numberlink-shared-ts/numberlink-state';
import type {
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import {
  PathGridBoard,
  type PathGridBoardProps,
} from '@pkgs/ui-root-client-ts/path-grid-board';
import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';

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
  /** The pair whose path is being drawn and not yet saved. */
  readonly drawingPair?: string | undefined;
};

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  return a.size === b.size && [...a].every((id) => b.has(id));
}

type CellOwner = {
  readonly pair: NumberlinkDefinition['pairs'][number];
  readonly endpoint: boolean;
};

function createCellLabels(
  props: NumberlinkBoardProps,
  connected: () => ReadonlySet<string>
) {
  const { t } = useLingui();
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
  const labels = createMemo(() =>
    Array.from(
      { length: props.definition.width * props.definition.height },
      (_, index) => {
        const coordinate = `${String.fromCharCode(65 + (index % props.definition.width))}${Math.floor(index / props.definition.width) + 1}`;
        const owner = createMemo(() => owners().get(index), {
          equals: (a, b) => a?.pair === b?.pair && a?.endpoint === b?.endpoint,
        });
        const joined = createMemo(() => {
          const item = owner();
          return item !== undefined && connected().has(item.pair.id);
        });
        return createMemo(() => {
          const item = owner();
          if (!item) return t`${coordinate}: empty`;
          const pair = item.pair;
          const status = joined() ? t`connected` : t`unfinished`;
          return item.endpoint
            ? t`${coordinate}: endpoint ${pair.label}, ${status}`
            : t`${coordinate}: path ${pair.label}, ${status}`;
        });
      }
    )
  );
  return (index: number): string => {
    const label = labels()[index];
    if (!label) throw new RangeError('Cell lies outside the board');
    return label();
  };
}

export function NumberlinkBoard(props: NumberlinkBoardProps): JSX.Element {
  const { t } = useLingui();
  // Equal membership keeps endpoints and statuses still while a path grows.
  const connected = createMemo(
    () => new Set(connectedPairs(props.definition, props.state)),
    { equals: sameMembers }
  );
  const endpoints = createMemo(() =>
    props.definition.pairs.flatMap((pair) =>
      pair.endpoints.map((cell) => ({
        cell: cell.y * props.definition.width + cell.x,
        label: pair.label,
        tracing: props.drawingPair === pair.id,
        tone: pair.color,
        connected: connected().has(pair.id),
      }))
    )
  );
  const pairStyles = createMemo(
    () =>
      new Map(
        props.definition.pairs.map((pair, index) => [
          pair.id,
          { tone: pair.color, stitch: index % 6 },
        ])
      )
  );
  const lines = createMemo(() =>
    props.state.paths.map((path) => {
      const style = pairStyles().get(path.pairId);
      if (!style)
        throw new Error('A validated path must name an endpoint pair');
      return {
        id: path.pairId,
        ...style,
        connected: connected().has(path.pairId),
        provisional: path.pairId === props.drawingPair,
        cells: path.cells.map(
          (cell) => cell.y * props.definition.width + cell.x
        ),
      };
    })
  );
  const label = createCellLabels(props, connected);
  return (
    <PathGridBoard
      columns={props.definition.width}
      rows={props.definition.height}
      label={t`Numberlink board`}
      navigationHint={t`Pinch to zoom. Drag with two fingers to pan. Double-tap to zoom or fit. Use + and − to zoom, or 0 to fit.`}
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
