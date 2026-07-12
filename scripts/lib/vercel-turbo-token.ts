const PLACEHOLDER_RE = /^<[^>]+>$/;
const MIN_TOKEN_LENGTH = 20;

export function assertVercelTurboToken(token: string): string | null {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return 'TURBO_TOKEN must not be empty';
  }
  if (PLACEHOLDER_RE.test(trimmed)) {
    return `TURBO_TOKEN looks like a placeholder (${trimmed}) — use a real Vercel token`;
  }
  if (trimmed.length < MIN_TOKEN_LENGTH) {
    return `TURBO_TOKEN is too short (${String(trimmed.length)} chars) — expected a Vercel access token`;
  }
  return null;
}
