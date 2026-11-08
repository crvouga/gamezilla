import { applyNumberlinkAction } from '@libs/numberlink-shared-ts/numberlink-state';
import type {
  Cell,
  NumberlinkAction,
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { sameCell } from '@libs/numberlink-shared-ts/numberlink-types';
import { useLingui } from '@lingui/solid/macro';
import type { PathGridTraceCancellation } from '@pkgs/ui-root-client-ts/path-grid-board';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';

type DrawingPorts = {
  readonly definition: Accessor<NumberlinkDefinition>;
  readonly state: Accessor<NumberlinkState>;
  readonly disabled: Accessor<boolean>;
  readonly onAction: (action: NumberlinkAction) => void;
};

function pairAt(
  definition: NumberlinkDefinition,
  state: NumberlinkState,
  cell: Cell
): string | undefined {
  return (
    definition.pairs.find((pair) =>
      pair.endpoints.some((endpoint) => sameCell(endpoint, cell))
    )?.id ??
    state.paths.find((path) => path.cells.some((at) => sameCell(at, cell)))
      ?.pairId
  );
}

function cellAt(index: number, width: number): Cell {
  return { x: index % width, y: Math.floor(index / width) };
}

function initialDrawing(
  ports: DrawingPorts,
  at: Cell
): NumberlinkAction | null {
  const pairId = pairAt(ports.definition(), ports.state(), at);
  if (pairId === undefined) return null;
  const endpoint = ports
    .definition()
    .pairs.some(
      (pair) =>
        pair.id === pairId && pair.endpoints.some((end) => sameCell(end, at))
    );
  const path = ports.state().paths.find((entry) => entry.pairId === pairId);
  const end = path?.cells.findIndex((entry) => sameCell(entry, at)) ?? -1;
  return {
    pairId,
    cells: endpoint || path === undefined ? [at] : path.cells.slice(0, end + 1),
  };
}

function createDrawingKey(
  ports: DrawingPorts,
  drawing: {
    readonly cancel: () => void;
    readonly escape: () => void;
    readonly clearError: () => void;
  }
) {
  const reset = (): void => {
    drawing.cancel();
    drawing.clearError();
  };
  return (name: string, index: number): boolean => {
    if (name === 'Escape') {
      drawing.escape();
      drawing.clearError();
      return true;
    }
    if (name !== 'Backspace' && name !== 'Delete') return false;
    const id = pairAt(
      ports.definition(),
      ports.state(),
      cellAt(index, ports.definition().width)
    );
    reset();
    if (id !== undefined && !ports.disabled())
      ports.onAction({ pairId: id, cells: [] });
    return true;
  };
}

function previewDrawing(
  ports: DrawingPorts,
  action: NumberlinkAction | null
): NumberlinkState {
  if (action === null) return ports.state();
  const next = applyNumberlinkAction(ports.definition(), ports.state(), action);
  return next.valid ? next.value : ports.state();
}

function createDrawingFeedback(
  gesture: Accessor<NumberlinkAction | null>,
  cancel: () => void
) {
  const { t } = useLingui();
  const [feedback, setFeedback] = createSignal<string | null>(null);
  // Every way a drawing can be abandoned says so in the same words.
  const cancelExplained = (explain: boolean): void => {
    const wasDrawing = gesture() !== null;
    cancel();
    if (wasDrawing && explain)
      setFeedback(
        t`Drawing canceled. Saved paths are unchanged. Start again from an endpoint.`
      );
  };
  const cancelTrace = (reason: PathGridTraceCancellation): void =>
    cancelExplained(reason !== 'stationary');
  return {
    feedback,
    cancelTrace,
    escape: () => cancelExplained(true),
    clear: () => setFeedback(null),
  };
}

/** A new puzzle, saved state or availability abandons any drawing in progress. */
function cancelOnNewInput(ports: DrawingPorts, cancel: () => void): void {
  createEffect(() => {
    void ports.definition();
    void ports.state();
    void ports.disabled();
    cancel();
  });
}

/** A drawing is provisional until it finishes; only the game rules can accept its cells. */
export function createNumberlinkDrawing(ports: DrawingPorts) {
  const { t } = useLingui();
  const [gesture, setGesture] = createSignal<NumberlinkAction | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  let refused = false;
  const cell = (index: number): Cell => cellAt(index, ports.definition().width);
  const cancel = (): void => {
    setGesture(null);
    refused = false;
  };
  const status = createDrawingFeedback(gesture, cancel);
  cancelOnNewInput(ports, cancel);
  const preview = createMemo(() => previewDrawing(ports, gesture()));
  const begin = (index: number): void => {
    if (ports.disabled()) return;
    const action = initialDrawing(ports, cell(index));
    if (action === null) {
      setError(t`Start at a matching endpoint or an existing path.`);
      return;
    }
    refused = false;
    setError(null);
    status.clear();
    setGesture(action);
  };
  const extend = (index: number): void => {
    const current = gesture();
    if (current === null || ports.disabled()) return;
    const at = cell(index);
    const visited = current.cells.findIndex((entry) => sameCell(entry, at));
    const cells =
      visited < 0
        ? [...current.cells, at]
        : current.cells.slice(0, visited + 1);
    const action = { pairId: current.pairId, cells };
    const next = applyNumberlinkAction(
      ports.definition(),
      ports.state(),
      action
    );
    refused = !next.valid;
    setError(
      next.valid ? null : (next.issues[0]?.message ?? t`Draw the path again.`)
    );
    if (next.valid) setGesture(action);
  };
  const finish = (): void => {
    const action = gesture();
    if (action !== null && !refused && !ports.disabled())
      ports.onAction(action);
    cancel();
  };
  const activate = (index: number): void => {
    if (gesture() === null) begin(index);
    else {
      extend(index);
      finish();
    }
  };
  const key = createDrawingKey(ports, {
    cancel,
    escape: status.escape,
    clearError: () => setError(null),
  });
  return {
    gesture,
    error,
    feedback: status.feedback,
    preview,
    begin,
    extend,
    finish,
    cancel,
    cancelTrace: status.cancelTrace,
    activate,
    key,
  };
}
