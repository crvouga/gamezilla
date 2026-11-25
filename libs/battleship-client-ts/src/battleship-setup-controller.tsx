import {
  CELLS,
  cellLabel,
  SHIPS,
  type ShipId,
  shipLength,
} from '@libs/battleship-shared-ts/battleship-board';
import type { Orientation } from '@libs/battleship-shared-ts/battleship-fleet';
import { t } from '@lingui/core/macro';
import type { GameSetupBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { CellGridCell } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { type Accessor, createMemo, createSignal } from 'solid-js';
import {
  GLYPHS,
  orientationName,
  refusalText,
  shipName,
} from './battleship-copy';
import {
  type Draft,
  draftShipAt,
  encodeDraft,
  type PlacementOutcome,
  type PlacementPreview,
  parseDraft,
  placeInDraft,
  previewPlacement,
  removeFromDraft,
  unplacedShips,
} from './battleship-draft';

import { type FleetDrag, pickUpShip } from './battleship-drag';
import { hullEdges } from './battleship-hull';

export type SetupController = {
  readonly pickup: (cell: string) => FleetDrag | undefined;
  readonly draft: Accessor<Draft>;
  /** The ship a cell press places: the one chosen, else the next to place. */
  readonly selected: Accessor<ShipId | null>;
  readonly orientation: Accessor<Orientation>;
  readonly refusal: Accessor<string | null>;
  readonly cells: Accessor<readonly CellGridCell[]>;
  readonly status: Accessor<string>;
  readonly instruction: Accessor<string>;
  readonly choose: (ship: ShipId) => void;
  readonly place: (cell: string) => void;
  readonly rotate: () => void;
  readonly rotateKey: (key: string) => boolean;
  readonly remove: () => void;
  readonly preview: (cell: string | null) => void;
};
type SetupView = {
  readonly draft: Draft;
  readonly selected: ShipId | null;
  readonly enabled: boolean;
};
type SetupState = {
  readonly props: GameSetupBoardProps;
  readonly draft: Accessor<Draft>;
  readonly selected: Accessor<ShipId | null>;
  readonly orientation: Accessor<Orientation>;
  readonly setChosen: (ship: ShipId | null) => void;
  readonly setOrientation: (orientation: Orientation) => void;
  readonly setRefusal: (text: string | null) => void;
};
type SetupActions = Pick<
  SetupController,
  'choose' | 'place' | 'rotate' | 'remove'
>;

function previewCells(
  cells: readonly CellGridCell[],
  preview: PlacementPreview | null
): readonly CellGridCell[] {
  if (!preview) return cells;
  return cells.map((cell) =>
    preview.cells.includes(cell.id)
      ? {
          ...cell,
          glyph: preview.valid ? cell.glyph || GLYPHS.fits : GLYPHS.refused,
          emphasis: preview.valid ? 'preview' : 'refused',
          previewEdges: hullEdges(preview.cells, cell.id),
        }
      : cell
  );
}
function setupCell(cell: string, view: SetupView): CellGridCell {
  const label = cellLabel(cell);
  const occupant = draftShipAt(view.draft, cell);
<<<<<<< HEAD
||||||| 8cf8794cd7
  const previewed = view.preview?.cells.includes(cell) === true;
  const valid = view.preview?.valid === true;
=======
  const previewed = view.preview?.cells.includes(cell) === true;
  const valid = view.preview?.valid === true;
  // A spot the ship cannot take reads as refused over whatever lies there,
  // so a preview never looks laid over the ship it would overlap.
  const refused = previewed && !valid;
>>>>>>> origin/main
  const name = occupant === null ? '' : shipName(occupant.ship);
  return {
    id: cell,
<<<<<<< HEAD
    glyph: occupant ? GLYPHS.ship : '',
    tone: occupant === null ? 'open' : 'occupied',
    edges: occupant ? hullEdges(occupant.cells, cell) : undefined,
||||||| 8cf8794cd7
    glyph: setupGlyph(occupant !== null, previewed, valid),
    tone: occupant === null ? 'open' : 'occupied',
=======
    glyph: refused
      ? GLYPHS.refused
      : setupGlyph(occupant !== null, previewed, valid),
    tone: refused ? 'alert' : occupant === null ? 'open' : 'occupied',
>>>>>>> origin/main
    outlined: occupant !== null && occupant.ship === view.selected,
    enabled: view.enabled,
    label: occupant === null ? t`${label}: open water` : t`${label}: ${name}`,
  };
}
function statusText(
  draft: Draft,
  selected: ShipId | null,
  _orientation: Orientation
): string {
  if (unplacedShips(draft).length === 0)
    return t`All five ships placed. Your fleet is ready.`;
  const placed = draft.size;
  const total = SHIPS.length;
  const count = t`${placed} of ${total} ships placed.`;
  if (selected === null) return count;
  return count;
}
function placementInstruction(
  selected: ShipId | null,
  orientation: Orientation
): string {
  if (selected === null)
    return t`Drag a ship to move it, or choose it to rotate or remove it.`;
  const name = shipName(selected);
  const length = shipLength(selected);
  const direction = orientationName(orientation);
  return t`${name}: ${length} cells ${direction}. Tap its bow cell or drag to preview placement.`;
}

/** Why the spot under the pointer is refused, said where guidance is. */
function previewRefusal(
  draft: Draft,
  ship: ShipId | null,
  bow: string | null,
  orientation: Orientation
): string | null {
  if (ship === null || bow === null) return null;
  const outcome = placeInDraft(draft, ship, { bow, orientation });
  if (outcome.ok) return null;
  const reason = refusalText(ship, outcome.refusal);
  return outcome.refusal.kind === 'overlap'
    ? t`${reason} That spot is taken: choose another bow cell or rotate.`
    : t`${reason} Choose another bow cell or rotate.`;
}

/** Commits an accepted change; a refused one only says why. */
function commit(
  state: SetupState,
  ship: ShipId,
  outcome: PlacementOutcome
): boolean {
  if (!outcome.ok) {
    state.setRefusal(refusalText(ship, outcome.refusal));
    return false;
  }
  state.setRefusal(null);
  state.props.onChange(encodeDraft(outcome.draft));
  return true;
}
function setupActions(state: SetupState): SetupActions {
  const editable = (): ShipId | null =>
    state.props.locked ? null : state.selected();
  return {
    choose: (ship) => {
      if (state.props.locked) return;
      state.setChosen(ship);
      state.setRefusal(null);
      const placed = state.draft().get(ship);
      if (placed !== undefined) state.setOrientation(placed.orientation);
    },
    place: (cell) => {
      const ship = editable();
      if (ship === null) return;
      const placement = { bow: cell, orientation: state.orientation() };
      if (commit(state, ship, placeInDraft(state.draft(), ship, placement)))
        state.setChosen(null);
    },
    rotate: () => {
      const ship = editable();
      if (ship === null) return;
      const next: Orientation = state.orientation() === 'h' ? 'v' : 'h';
      state.setOrientation(next);
      const placed = state.draft().get(ship);
      if (placed === undefined) {
        state.setRefusal(null);
        return;
      }
      const placement = { bow: placed.bow, orientation: next };
      commit(state, ship, placeInDraft(state.draft(), ship, placement));
    },
    remove: () => {
      const ship = editable();
      if (ship === null || !state.draft().has(ship)) return;
      state.setRefusal(null);
      state.setChosen(ship);
      state.props.onChange(encodeDraft(removeFromDraft(state.draft(), ship)));
    },
  };
}

/** The setup board's state: what is chosen, previewed and refused. */
export function createSetupController(
  props: GameSetupBoardProps
): SetupController {
  const draft = createMemo(() => parseDraft(props.setup));
  const [chosen, setChosen] = createSignal<ShipId | null>(null);
  const [orientation, setOrientation] = createSignal<Orientation>('h');
  const [hovered, setHovered] = createSignal<string | null>(null);
  const [refusal, setRefusal] = createSignal<string | null>(null);
  const selected = createMemo(
    () => chosen() ?? unplacedShips(draft())[0] ?? null
  );
  const placing = createMemo(() => {
    const ship = selected();
    const bow = hovered();
    if (props.locked || ship === null || bow === null) return null;
    return previewPlacement(draft(), ship, { bow, orientation: orientation() });
  });
  const state: SetupState = {
    props,
    draft,
    selected,
    orientation,
    setChosen,
    setOrientation,
    setRefusal,
  };
  const actions = setupActions(state);
  const [drag, setDrag] = createSignal<PlacementPreview | null>(null);
  const chart = createMemo(() =>
    CELLS.map((cell) =>
      setupCell(cell, {
        draft: draft(),
        selected: selected(),
        enabled: !props.locked && selected() !== null,
      })
    )
  );
  const cells = createMemo(() => previewCells(chart(), drag() ?? placing()));
  const status = createMemo(() =>
    statusText(draft(), selected(), orientation())
  );
  return {
    ...actions,
    rotateKey: (key) => {
      if (key.toLowerCase() !== 'r') return false;
      actions.rotate();
      return true;
    },
    pickup: (cell) =>
      props.locked
        ? undefined
        : pickUpShip(
            {
              draft: draft(),
              selected: selected(),
              orientation: orientation(),
              show: (preview) => {
                setDrag(preview);
                if (!preview) setHovered(null);
              },
              place: (ship, placement) => {
                if (
                  !props.locked &&
                  commit(state, ship, placeInDraft(draft(), ship, placement))
                )
                  setChosen(null);
              },
            },
            cell
          ),
    draft,
    selected,
    orientation,
    refusal,
    cells,
    status,
    instruction: () =>
      (placing()?.valid === false
        ? previewRefusal(draft(), selected(), hovered(), orientation())
        : null) ?? placementInstruction(selected(), orientation()),
    preview: setHovered,
  };
}
