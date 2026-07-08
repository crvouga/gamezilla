import { main } from '../cli/main';
import { fail } from '../cli/lib/fmt';
import { GitHubActionsPlatform } from '../cli/platform/github-actions';
import { LocalPlatform } from '../cli/platform/local';

/**
 * Infra CLI targets secrets env `prd` unless `SECRETS_ENV` is set.
 */
const secretsEnvRaw = process.env['SECRETS_ENV'];
if (typeof secretsEnvRaw !== 'string' || secretsEnvRaw.trim() === '') {
  process.env['SECRETS_ENV'] = 'prd';
}

const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';
const platform = isGitHubActions
  ? new GitHubActionsPlatform()
  : new LocalPlatform();

main(platform).catch((e: unknown) => {
  fail(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
