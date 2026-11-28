/**
 * Eight softly squared ticks travel around a recessed dial. Advancing in whole
 * steps keeps the marks crisp at 16px. Both the app and the harness first
 * paint use this geometry, color inheritance and timing.
 */

/**
 * Petal count, and the number of steps per revolution: the `steps(…)` of
 * `spinner.module.css` and the developer console.
 */
export const ACTIVITY_PETALS = 8;

/** One revolution. */
export const ACTIVITY_REVOLUTION_MS = 1000;

/** Coordinates are in a 100 × 100 box centered on (50, 50). */
const VIEWBOX = 100;
const PETAL_WIDTH = 14;
/** Enough inset for the fixed socket rim at the smallest size. */
const PETAL_TOP = 10;
const PETAL_LENGTH = 20;
/** The petal furthest behind the leader keeps this much opacity. */
const TAIL_OPACITY = 0.3;

export type ActivityPetal = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  /** Clockwise from twelve o'clock, degrees. */
  readonly angle: number;
  readonly opacity: number;
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * The petals, leader first. The leader points up at full opacity; each
 * petal counter-clockwise behind it is one step dimmer.
 */
export const ACTIVITY_PETAL_SHAPES: readonly ActivityPetal[] = Array.from(
  { length: ACTIVITY_PETALS },
  (_, index) => ({
    x: round((VIEWBOX - PETAL_WIDTH) / 2),
    y: PETAL_TOP,
    width: PETAL_WIDTH,
    height: PETAL_LENGTH,
    radius: 4,
    angle: (360 - index * (360 / ACTIVITY_PETALS)) % 360,
    opacity: round(1 - (index * (1 - TAIL_OPACITY)) / (ACTIVITY_PETALS - 1)),
  })
);

export const ACTIVITY_VIEWBOX = `0 0 ${VIEWBOX} ${VIEWBOX}`;

/** `rotate(…)` about the center, for a petal's `transform` attribute. */
export function petalTransform(petal: ActivityPetal): string {
  return `rotate(${petal.angle} ${VIEWBOX / 2} ${VIEWBOX / 2})`;
}

/**
 * Static markup of the indicator at `size` px, painting `currentColor`.
 * The element turns under the `.activity-indicator` keyframes of the page
 * that embeds it.
 */
export function activityIndicatorMarkup(size: number): string {
  const petals = ACTIVITY_PETAL_SHAPES.map(
    (petal) =>
      `<rect x="${petal.x}" y="${petal.y}" width="${petal.width}" height="${petal.height}" rx="${petal.radius}" transform="${petalTransform(petal)}" opacity="${petal.opacity}"/>`
  ).join('');
  return `<span class="activity-socket"><svg class="activity-indicator" width="${size}" height="${size}" viewBox="${ACTIVITY_VIEWBOX}" fill="currentColor" aria-hidden="true">${petals}</svg></span>`;
}
