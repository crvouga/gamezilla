/**
 * Paths that belong to the Hono API Worker (`/api/*` on api.gamezilla.app).
 */
export function isApiRequestPath(pathname: string): boolean {
  return pathname.startsWith('/api/');
}
