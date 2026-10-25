/** Clockwise order: turning right adds one, turning left subtracts one. */
export const LIGHT_CYCLES_HEADINGS = ['up', 'right', 'down', 'left'] as const;
export type LightCyclesHeading = (typeof LIGHT_CYCLES_HEADINGS)[number];

const DELTAS: Readonly<
  Record<LightCyclesHeading, { readonly dx: number; readonly dy: number }>
> = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

export function isLightCyclesHeading(
  value: unknown
): value is LightCyclesHeading {
  return (
    typeof value === 'string' &&
    (LIGHT_CYCLES_HEADINGS as readonly string[]).includes(value)
  );
}

function rotate(heading: LightCyclesHeading, by: number): LightCyclesHeading {
  const index = LIGHT_CYCLES_HEADINGS.indexOf(heading);
  return LIGHT_CYCLES_HEADINGS[(index + by + 4) % 4]!;
}

export function oppositeHeading(
  heading: LightCyclesHeading
): LightCyclesHeading {
  return rotate(heading, 2);
}

export function leftOf(heading: LightCyclesHeading): LightCyclesHeading {
  return rotate(heading, -1);
}

export function rightOf(heading: LightCyclesHeading): LightCyclesHeading {
  return rotate(heading, 1);
}

export function isReversal(
  from: LightCyclesHeading,
  to: LightCyclesHeading
): boolean {
  return oppositeHeading(from) === to;
}

/** The headings a rider may take from `heading`: straight, left, right. */
export function legalHeadings(
  heading: LightCyclesHeading
): readonly LightCyclesHeading[] {
  return [heading, leftOf(heading), rightOf(heading)];
}

export type LightCyclesCell = { readonly x: number; readonly y: number };

/** The neighbouring cell in `heading`; it may lie outside the arena. */
export function stepCell(
  cell: LightCyclesCell,
  heading: LightCyclesHeading
): LightCyclesCell {
  const delta = DELTAS[heading];
  return { x: cell.x + delta.dx, y: cell.y + delta.dy };
}
