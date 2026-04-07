import { assert } from '@gamezilla/shared/assert';
import { main } from '../cli/main';
import { GitHubActionsPlatform, LocalPlatform } from '../cli/platform/platform';

const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';
const platform = isGitHubActions
  ? new GitHubActionsPlatform()
  : new LocalPlatform();

main(platform).catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  platform.error(message);
  assert.fail(`infra-cli: unhandled error — ${message}`);
});
