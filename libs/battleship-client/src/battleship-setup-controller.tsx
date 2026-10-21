import {
  CELLS,
  cellLabel,
  SHIPS,
  type ShipId,
  shipLength,
} from '@libs/battleship-shared/battleship-board';
import type { Orientation } from '@libs/battleship-shared/battleship-fleet';
import { t } from '@lingui/core/macro';
import type { GameSetupBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import type { CellGridCell } from '@pkgs/ui-root-client/cell-grid-board';
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

export type SetupController = {
  readonly draft: Accessor<Draft>;
  /** The ship a cell press places: the one chosen, else the next to place. */
  readonly selected: Accessor<ShipId | null>;
  readonly orientation: Accessor<Orientation>;
  readonly refusal: Accessor<string | null>;
  readonly cells: Accessor<readonly CellGridCell[]>;
  readonly status: Accessor<string>;
  readonly choose: (ship: ShipId) => void;
  readonly place: (cell: string) => void;
  readonly rotate: () => void;
  readonly remove: () => void;
  readonly preview: (cell: string | null) => void;
};
type SetupView = {
  readonly draft: Draft;
  readonly selected: ShipId | null;
  readonly preview: PlacementPreview | null;
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

function setupGlyph(
  occupied: boolean,
  previewed: boolean,
  valid: boolean
): string {
  if (occupied) return GLYPHS.ship;
  if (!previewed) return '';
  return valid ? GLYPHS.fits : GLYPHS.refused;
}
function setupCell(cell: string, view: SetupView): CellGridCell {
  const label = cellLabel(cell);
  const occupant = draftShipAt(view.draft, cell);
  const previewed = view.preview?.cells.includes(cell) === true;
  const valid = view.preview?.valid === true;
  const name = occupant === null ? '' : shipName(occupant.ship);
  return {
    id: cell,
    glyph: setupGlyph(occupant !== null, previewed, valid),
    tone: occupant === null ? 'open' : 'occupied',
    outlined: occupant !== null && occupant.ship === view.selected,
    emphasis: previewed ? (valid ? 'preview' : 'refused') : 'none',
    enabled: view.enabled,
    label: occupant === null ? t`${label}: open water` : t`${label}: ${name}`,
  };
}
function statusText(
  draft: Draft,
  selected: ShipId | null,
  orientation: Orientation
): string {
  if (unplacedShips(draft).length === 0)
    return t`All five ships placed. Your fleet is ready.`;
  const placed = draft.size;
  const total = SHIPS.length;
  const count = t`${placed} of ${total} ships placed.`;
  if (selected === null) return count;
  const name = shipName(selected);
  const length = shipLength(selected);
  const direction = orientationName(orientation);
  const hint = t`Choose the bow cell for the ${name}: ${length} cells, ${direction}. Press R to rotate.`;
  return `${count} ${hint}`;
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
  const selected = () => chosen() ?? unplacedShips(draft())[0] ?? null;
  const placing = createMemo(() => {
    const ship = selected();
    const bow = hovered();
    if (props.locked || ship === null || bow === null) return null;
    return previewPlacement(draft(), ship, { bow, orientation: orientation() });
  });
  const actions = setupActions({
    props,
    draft,
    selected,
    orientation,
    setChosen,
    setOrientation,
    setRefusal,
  });
  const cells = createMemo(() =>
    CELLS.map((cell) =>
      setupCell(cell, {
        draft: draft(),
        selected: selected(),
        preview: placing(),
        enabled: !props.locked && selected() !== null,
      })
    )
  );
  const status = createMemo(() =>
    statusText(draft(), selected(), orientation())
  );
  return {
    ...actions,
    draft,
    selected,
    orientation,
    refusal,
    cells,
    status,
    preview: setHovered,
  };
}
