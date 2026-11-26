import {
  offsetCell,
  type ShipId,
  shipLength,
} from '@libs/battleship-shared-ts/battleship-board';
import type {
  Orientation,
  Placement,
} from '@libs/battleship-shared-ts/battleship-fleet';
import {
  type Draft,
  draftShipAt,
  type PlacementPreview,
  previewPlacement,
} from './battleship-draft';

export type FleetDrag = {
  preview: (cell: string | null) => void;
  drop: (cell: string) => void;
};
type DragContext = {
  draft: Draft;
  selected: ShipId | null;
  orientation: Orientation;
  show: (preview: PlacementPreview | null) => void;
  place: (ship: ShipId, placement: Placement) => void;
};
export function pickUpShip(
  context: DragContext,
  origin: string
): FleetDrag | undefined {
  const hull = draftShipAt(context.draft, origin);
  const ship = hull?.ship ?? context.selected;
  if (!ship) return;
  const orientation = hull?.orientation ?? context.orientation;
  const offset = hull?.cells.indexOf(origin) ?? 0;
  const delta = orientation === 'h' ? { dc: 1, dr: 0 } : { dc: 0, dr: 1 };
  const bowAt = (cell: string) => offsetCell(cell, delta, -offset);
  let previous: string | null | undefined;
  return {
    preview(cell) {
      if (cell === previous) return;
      previous = cell;
      if (!cell) {
        context.show(null);
        return;
      }
      const bow = bowAt(cell);
      if (bow)
        context.show(
          previewPlacement(context.draft, ship, { bow, orientation })
        );
      else {
        const cells = Array.from({ length: shipLength(ship) }, (_, i) =>
          offsetCell(cell, delta, i - offset)
        ).filter((at): at is string => at !== null);
        context.show({ valid: false, cells });
      }
    },
    drop(cell) {
      const bow = bowAt(cell);
      if (bow) context.place(ship, { bow, orientation });
    },
  };
}
