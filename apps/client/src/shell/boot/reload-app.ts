/** Hard reload the product Window (stale worker / SW recovery). */
export function reloadApp(): void {
  const loc = (globalThis as { location?: { reload(): void } }).location;
  loc?.reload();
}
