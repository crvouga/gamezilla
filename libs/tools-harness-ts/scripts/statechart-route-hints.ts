import type { StateMeta } from '@crvouga/atlas';

/** Make statically verified app addresses readable in Atlas's standard detail panel. */
export function withRouteHints(meta: StateMeta): StateMeta {
  const hints = meta['hints'];
  if (
    hints !== undefined &&
    (!Array.isArray(hints) || hints.some((hint) => typeof hint !== 'string'))
  )
    throw new Error('State hints must contain only readable strings');
  const listed = meta['routes'];
  const routes = [
    meta['route'],
    ...(Array.isArray(listed) ? listed : []),
  ].filter((route): route is string => typeof route === 'string');
  if (!routes.length) return meta;
  return {
    ...meta,
    hints: [
      ...(hints ?? []),
      ...routes.map((route) => `App address: ${route}`),
    ],
  };
}
