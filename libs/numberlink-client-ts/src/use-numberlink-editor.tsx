import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { decodeNumberlinkDraft } from '@libs/numberlink-shared-ts/numberlink-definition';
import type {
  EndpointPair,
  NumberlinkDefinition,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { useLingui } from '@lingui/solid/macro';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import {
  movedNumberlinkEndpoint,
  replaceNumberlinkPair,
  resizedNumberlinkBoard,
  withNewNumberlinkPair,
} from './numberlink-editor-actions';

function createEndpointSelection(board: Accessor<NumberlinkDefinition | null>) {
  const [selected, setSelected] = createSignal('');
  const [endpoint, setEndpoint] = createSignal<0 | 1>(0);
  const pair = createMemo(() =>
    board()?.pairs.find((current) => current.id === selected())
  );
  createEffect(() => {
    if (pair() === undefined) setSelected(board()?.pairs[0]?.id ?? '');
  });
  return { selected, setSelected, endpoint, setEndpoint, pair };
}

type DraftChange = (
  next: NumberlinkDefinition | null,
  refusal: string
) => boolean;

function createEndpointRemoval(
  board: Accessor<NumberlinkDefinition | null>,
  change: DraftChange
) {
  return {
    remove(id: string): void {
      const current = board();
      if (current !== null)
        change(
          {
            ...current,
            pairs: current.pairs.filter((entry) => entry.id !== id),
          },
          ''
        );
    },
    clear(): void {
      const current = board();
      if (current !== null) change({ ...current, pairs: [] }, '');
    },
  };
}

export function useNumberlinkEditor(props: PuzzleEditorProps) {
  const { t } = useLingui();
  const createId = useCreateId();
  const [error, setError] = createSignal<string | null>(null);
  const board = createMemo(() => {
    const parsed = decodeNumberlinkDraft(props.definition);
    return parsed.valid ? parsed.value : null;
  });
  const { selected, setSelected, endpoint, setEndpoint, pair } =
    createEndpointSelection(board);
  const change = (
    next: NumberlinkDefinition | null,
    refusal: string
  ): boolean => {
    if (props.disabled) return false;
    setError(next === null ? refusal : null);
    if (next !== null) props.onChange(JSON.stringify(next));
    return next !== null;
  };
  const editPair = (next: EndpointPair): void => {
    const current = board();
    if (current !== null) change(replaceNumberlinkPair(current, next), '');
  };
  const resize = (axis: 'width' | 'height', size: number): void => {
    const current = board();
    if (current === null) return;
    change(
      resizedNumberlinkBoard(current, {
        width: axis === 'width' ? size : current.width,
        height: axis === 'height' ? size : current.height,
      }),
      t`Move endpoints inside the smaller board before resizing it.`
    );
  };
  const add = (): void => {
    const current = board();
    if (current === null || props.disabled) return;
    const id = createId();
    change(
      withNewNumberlinkPair(current, id),
      t`There are no two open cells. Enlarge the board or remove a pair first.`
    );
    setSelected(id);
    setEndpoint(0);
  };
  const place = (index: number): void => {
    const current = board();
    const chosen = pair();
    if (current === null || chosen === undefined) return;
    const cell = {
      x: index % current.width,
      y: Math.floor(index / current.width),
    };
    const moved = change(
      movedNumberlinkEndpoint(current, chosen, endpoint(), cell),
      t`This cell already has an endpoint. Choose an empty cell.`
    );
    if (moved) setEndpoint((end) => (end === 0 ? 1 : 0));
  };
  return {
    board,
    pair,
    selected,
    setSelected,
    endpoint,
    setEndpoint,
    error,
    change,
    editPair,
    resize,
    add,
    place,
    ...createEndpointRemoval(board, change),
  };
}
