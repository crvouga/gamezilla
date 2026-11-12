import { cliHttp } from './cli-io';

function gitHubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2026-03-10',
    'User-Agent': 'bug-reports',
    'Content-Type': 'application/json',
  };
}

/**
 * Whether the token may open issues in the repository, asked without opening
 * one: GitHub refuses an issue with no title as unprocessable (422) only
 * after it has let the token in.
 */
export async function probeIssueWrite(
  token: string,
  repository: string
): Promise<void> {
  const response = await cliHttp.fetch(
    `https://api.github.com/repos/${repository}/issues`,
    { method: 'POST', headers: gitHubHeaders(token), body: '{}' }
  );
  await response.body?.cancel();
  if (response.status !== 422)
    throw new Error(
      `GitHub answered ${response.status} to ${repository}: the token needs Issues write access to that repository, which must take issues`
    );
}
