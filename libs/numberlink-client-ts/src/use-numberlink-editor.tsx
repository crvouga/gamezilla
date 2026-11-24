import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { decodeNumberlinkDraft } from '@libs/numberlink-shared-ts/numberlink-definition';
import type {
  EndpointPair,
  NumberlinkDefinition,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { type Accessor, createMemo, createSignal } from 'solid-js';
import {
  movedNumberlinkEndpoint,
  replaceNumberlinkPair,
  resizedNumberlinkBoard,
  withNewNumberlinkPair,
} from './numberlink-editor-actions';

function createEndpointSelection(board: Accessor<NumberlinkDefinition | null>) {
  // A selection whose pair is gone falls to the board's first pair.
  const [selected, setSelected] = createSignal((before?: string): string => {
    const pairs = board()?.pairs ?? [];
    return pairs.some((current) => current.id === before)
      ? (before ?? '')
      : (pairs[0]?.id ?? '');
  });
  const [endpoint, setEndpoint] = createSignal<0 | 1>(0);
  const pair = createMemo(() =>
    board()?.pairs.find((current) => current.id === selected())
  );
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

/** What the editor reads besides the shared builder's props: new pair ids. */
export type NumberlinkEditorInputs = PuzzleEditorProps & {
  readonly createId: () => string;
};

export function useNumberlinkEditor(props: NumberlinkEditorInputs) {
  const { t } = useLingui();
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
    const id = props.createId();
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
