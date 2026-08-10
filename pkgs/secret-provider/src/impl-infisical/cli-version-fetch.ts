import { globalHttpFetch } from '@pkgs/http-client';

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'pkgs-secret-provider';

/**
 * Resolve the latest GitHub release tag for `repo`.
 *
 * Prefer the HTML redirect over the REST API — shared CI runners often exhaust
 * the unauthenticated API quota. Fall back to the API with `GITHUB_TOKEN` /
 * `GH_TOKEN` when set.
 */
export async function fetchLatestGithubReleaseVersion(
  repo: string,
  extractVersion: (tag: string) => string | null
): Promise<string | null> {
  return (
    (await fetchLatestViaRedirect(repo, extractVersion)) ??
    (await fetchLatestViaApi(repo, extractVersion))
  );
}

async function fetchLatestViaRedirect(
  repo: string,
  extractVersion: (tag: string) => string | null
): Promise<string | null> {
  try {
    const res = await globalHttpFetch(
      `https://github.com/${repo}/releases/latest`,
      {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    const m = /\/releases\/tag\/(v?[\d]+\.[\d]+[\w.+-]*)$/.exec(res.url);
    return m?.[1] !== undefined ? extractVersion(m[1]) : null;
  } catch {
    return null;
  }
}

async function fetchLatestViaApi(
  repo: string,
  extractVersion: (tag: string) => string | null
): Promise<string | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
    };
    const token = (
      process.env['GITHUB_TOKEN'] ??
      process.env['GH_TOKEN'] ??
      ''
    ).trim();
    if (token.length > 0) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await globalHttpFetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers,
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
