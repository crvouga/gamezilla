/**
 * Paths routed to the Hono API before the static-assets binding.
 * Must stay in sync with `run_worker_first` in `apps/api/wrangler.toml`.
 */
export function isApiRequestPath(pathname: string): boolean {
  return (
    pathname === '/health' ||
    pathname === '/room' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/patch-db/') ||
    pathname.startsWith('/matchmaking/') ||
    pathname.startsWith('/stripe/') ||
    pathname.startsWith('/client-config/') ||
    pathname.startsWith('/llm/') ||
    pathname.startsWith('/tts/')
  );
}
