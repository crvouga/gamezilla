/* eslint-disable expo/no-dynamic-env-var */
import { assert } from '@gamezilla/shared/assert';
import { GitHubActionsPlatform } from '../deployment-pipeline-cli/ci-platform-github';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { main } from '../deployment-pipeline-cli/main';

const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';
const platform = isGitHubActions
  ? new GitHubActionsPlatform()
  : new LocalPlatform();

main(platform).catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  platform.error(message);
  assert.fail(`deployment-pipeline-cli: unhandled error — ${message}`);
});
