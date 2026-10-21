/** Hard reload the product Window (stale worker / SW recovery). */
export function reloadApp(): void {
  const loc = (globalThis as { location?: { reload(): void } }).location;
  loc?.reload();
}

/**
 * Full navigation to `path` in the product Window: a fresh page, so whatever
 * broke the current one (a crashed screen, its providers) is left behind.
 */
export function openAppAt(path: string): void {
  const loc = (globalThis as { location?: { assign(url: string): void } })
    .location;
  loc?.assign(path);
}
