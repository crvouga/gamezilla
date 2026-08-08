/**
 * Origins Better Auth may redirect to after OAuth (Expo scheme + web).
 * Must include Expo web (`:5173`) — BA rejects POST Origin / absolute
 * callbackURL when missing (`INVALID_ORIGIN` / `INVALID_CALLBACK_URL`).
 */
export function buildBetterAuthTrustedOrigins(args: {
  readonly apiBaseURL: string;
  readonly clientWebOrigins?: readonly string[];
}): string[] {
  const origins = new Set<string>([
    'gamezilla://',
    'gamezilla://*',
    'exp://',
    'exp://**',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    // Expo web / Metro (`apps/client` `expo start --port 5173`)
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    args.apiBaseURL.replace(/\/$/, ''),
  ]);
  for (const origin of args.clientWebOrigins ?? []) {
    const trimmed = origin.trim().replace(/\/$/, '');
    if (trimmed.length > 0) origins.add(trimmed);
  }
  return [...origins];
}
