/**
 * An objective measured only against a deployment starts with `# live`.
 * The harness does not run it. See specs/README.md (live checks).
 */

/** True when the first non-empty line marks the objective as deployment-only. */
export function isLiveObjectiveSource(text: string): boolean {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length === 0) continue;
    return line === '# live';
  }
  return false;
}