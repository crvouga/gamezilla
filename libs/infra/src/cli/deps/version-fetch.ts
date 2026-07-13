import { INFRA_CLI_USER_AGENT as UA } from '../constants';

/** Network budget for a single "what's the latest version?" probe. */
export const FETCH_TIMEOUT_MS = 15_000;

/**
 * Resolve the latest published version of an npm package from the public
 * registry's `/<pkg>/latest` dist-tag document. Returns `null` on any
 * network / parse failure so callers can degrade gracefully.
 */
export async function fetchLatestNpmVersion(
  pkg: string
): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { version?: string };
    return typeof j.version === 'string' ? j.version.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the latest GitHub release for `<owner>/<repo>` and map its
 * `tag_name` to a bare version via `extractVersion` (tag formats vary per
 * tool). Returns `null` on any network / parse failure or when the tag does
 * not match the extractor.
 */
export async function fetchLatestGithubReleaseVersion(
  repo: string,
  extractVersion: (tag: string) => string | null
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': UA },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { tag_name?: string };
    return extractVersion(j.tag_name?.trim() ?? '');
  } catch {
    return null;
  }
}
