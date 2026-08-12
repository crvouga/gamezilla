/** CSS `linear-gradient(...)` from expo-linear-gradient start/end + stops. */

export type GradientPoint = { x: number; y: number };

function angleDeg(start: GradientPoint, end: GradientPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.atan2(dx, -dy) * (180 / Math.PI);
}

export function linearGradientCss(
  colors: readonly string[],
  start: GradientPoint,
  end: GradientPoint
): string {
  const stops = colors.join(', ');
  return `background-image:linear-gradient(${angleDeg(start, end)}deg, ${stops})`;
}

export function mergeCss(
  base: string | undefined,
  extra: string | undefined
): string | undefined {
  if (base && extra) return `${base};${extra}`;
  return extra ?? base;
}
