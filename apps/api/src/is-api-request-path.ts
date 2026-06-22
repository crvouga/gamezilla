/**
 * Paths routed to the Hono API before the static-assets binding.
 * Must stay in sync with `run_worker_first` in `apps/api/wrangler.toml`.
 */
export function isApiRequestPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}
