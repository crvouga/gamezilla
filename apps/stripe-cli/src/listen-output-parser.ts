/**
 * Parse Stripe CLI `listen` stdout for the webhook signing secret.
 * CLI may wrap output in ANSI SGR sequences.
 */
const WHSEC_PATTERN =
  /Your webhook signing secret is (whsec_[A-Za-z0-9_]+)/i;

function stripAnsi(line: string): string {
  return line.replace(/\u001b\[[0-9;]*m/g, '');
}

export function parseWhsecFromLine(line: string): string | null {
  const cleaned = stripAnsi(line);
  const m = WHSEC_PATTERN.exec(cleaned);
  if (m === null || m[1] === undefined) return null;
  const v = m[1].trim();
  return v.length > 0 ? v : null;
}
