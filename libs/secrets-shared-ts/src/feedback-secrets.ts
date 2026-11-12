import { cliHttp } from './cli-io';
import { requireNonEmpty, Secret } from './secret';

const REPOSITORY = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

function gitHubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
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
  if (response.status !== 422)
    throw new Error(
      `GitHub answered ${response.status} to ${repository}: the token needs Issues write access to that repository, which must take issues`
    );
}

/**
 * Bug reports are business critical: both are required everywhere, entered
 * once for the account, and checked against GitHub itself so a revoked or
 * expired token is found by the secrets check and the health run.
 */
export const FEEDBACK_GITHUB_TOKEN = new Secret({
  name: 'FEEDBACK_GITHUB_TOKEN',
  hint: 'Fine-grained GitHub token with Issues write access to the bug report repository only',
  pushToApiWorker: true,
  validate: async (input) => {
    requireNonEmpty(input.secretValue, 'FEEDBACK_GITHUB_TOKEN');
    const repository =
      input.secrets.get('FEEDBACK_GITHUB_REPOSITORY')?.trim() ?? '';
    if (!REPOSITORY.test(repository))
      throw new Error('Set FEEDBACK_GITHUB_REPOSITORY (owner/repository) too');
    await probeIssueWrite(input.secretValue.trim(), repository);
  },
});

export const FEEDBACK_GITHUB_REPOSITORY = new Secret({
  name: 'FEEDBACK_GITHUB_REPOSITORY',
  hint: 'Destination owner/repository for bug reports',
  pushToApiWorker: true,
  validate: (input) => {
    if (!REPOSITORY.test(input.secretValue.trim()))
      throw new Error('Use owner/repository');
    return Promise.resolve();
  },
});
