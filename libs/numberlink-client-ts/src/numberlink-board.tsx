import { connectedPairs } from '@libs/numberlink-shared-ts/numberlink-state';
import type {
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { sameCell } from '@libs/numberlink-shared-ts/numberlink-types';
import { useLingui } from '@lingui/solid/macro';
import {
  PathGridBoard,
  type PathGridBoardProps,
} from '@pkgs/ui-root-client-ts/path-grid-board';
import { createMemo, type JSX } from 'solid-js';

type NumberlinkBoardProps = Pick<
  PathGridBoardProps,
  | 'disabled'
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

export function NumberlinkBoard(props: NumberlinkBoardProps): JSX.Element {
  const { t } = useLingui();
  const connected = createMemo(
    () => new Set(connectedPairs(props.definition, props.state))
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
  const label = (index: number): string => {
    const cell = {
      x: index % props.definition.width,
      y: Math.floor(index / props.definition.width),
    };
    const coordinate = `${String.fromCharCode(65 + cell.x)}${cell.y + 1}`;
    const endpoint = props.definition.pairs.find((pair) =>
      pair.endpoints.some((end) => sameCell(end, cell))
    );
    const path = props.state.paths.find((entry) =>
      entry.cells.some((at) => sameCell(at, cell))
    );
    const pair =
      endpoint ??
      props.definition.pairs.find((entry) => entry.id === path?.pairId);
    if (pair === undefined) return t`${coordinate}: empty`;
    const status = connected().has(pair.id) ? t`connected` : t`unfinished`;
    return endpoint === undefined
      ? t`${coordinate}: path ${pair.label}, ${status}`
      : t`${coordinate}: endpoint ${pair.label}, ${status}`;
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
