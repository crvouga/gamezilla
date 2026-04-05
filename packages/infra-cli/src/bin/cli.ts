import { assert } from '@gamezilla/shared/assert';
import { GitHubActionsPlatform, LocalPlatform } from '../cli/platform';
import { main } from '../cli/main';

const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';
const platform = isGitHubActions
  ? new GitHubActionsPlatform()
  : new LocalPlatform();

main(platform).catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  platform.error(message);
  assert.fail(`infra-cli: unhandled error — ${message}`);
});
