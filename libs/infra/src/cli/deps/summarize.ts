/**
 * Collapse a captured stdout/stderr stream into a short single-line
 * diagnostic: the first three lines joined, with a `(+N more lines)` tail
 * when truncated. Shared by the CLI deps that surface command output in
 * their `check()` failure reasons.
 */
export function summarize(stream: string): string {
  const trimmed = stream.trim();
  if (trimmed.length === 0) return '<empty>';
  const lines = trimmed.split('\n');
  const head = lines.slice(0, 3).join(' / ');
  return lines.length > 3
    ? `${head} … (+${String(lines.length - 3)} more lines)`
    : head;
}
