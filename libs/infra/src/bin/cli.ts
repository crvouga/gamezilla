import { main } from '../cli/main';
import { fail } from '../cli/lib/fmt';
import { GitHubActionsPlatform } from '../cli/platform/github-actions';
import { LocalPlatform } from '../cli/platform/local';

/**
 * Infra CLI targets Vault config `prd` unless `VAULT_CONFIG` is set.
 */
const vaultConfigRaw = process.env['VAULT_CONFIG'];
if (typeof vaultConfigRaw !== 'string' || vaultConfigRaw.trim() === '') {
  process.env['VAULT_CONFIG'] = 'prd';
}

const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';
const platform = isGitHubActions
  ? new GitHubActionsPlatform()
  : new LocalPlatform();

main(platform).catch((e: unknown) => {
  fail(e instanceof Error ? e.message : String(e));
});
