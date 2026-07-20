const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = 'gamezilla-secret-provider';

export async function fetchLatestGithubReleaseVersion(
  repo: string,
  extractVersion: (tag: string) => string | null
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': USER_AGENT,
        },
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
