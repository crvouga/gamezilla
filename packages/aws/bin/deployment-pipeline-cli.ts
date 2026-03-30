/* eslint-disable expo/no-dynamic-env-var */
import assert from 'node:assert/strict';
import { GitHubActionsPlatform } from '../deployment-pipeline-cli/ci-platform-github';
import { LocalPlatform } from '../deployment-pipeline-cli/ci-platform-local';
import { setCiPlatform, reportError } from '../deployment-pipeline-cli/ci-platform';
import { main } from '../deployment-pipeline-cli/main';

const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';
setCiPlatform(isGitHubActions ? new GitHubActionsPlatform() : new LocalPlatform());

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  reportError(message);
  assert.fail(`deployment-pipeline-cli: unhandled error — ${message}`);
});
