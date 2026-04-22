import { assert } from '@gamezilla/shared/assert';
import { main } from '../cli/main';
import { GitHubActionsPlatform } from '../cli/platform/github-actions';
import { LocalPlatform } from '../cli/platform/local';

const isGitHubActions = process.env['GITHUB_ACTIONS'] === 'true';
const platform = isGitHubActions
  ? new GitHubActionsPlatform()
  : new LocalPlatform();

main(platform)
  .then(() => {
    // Explicit exit: the infra CLI opens native resources (Bun Postgres pool,
    // wrangler child processes, Doppler spawns) whose handles can linger past
    // the last `await` and keep the event loop alive on CI, hanging the job.
    // Once `main` resolves we are done — force a clean exit.
    process.exit(0);
  })
  .catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    platform.error(message);
    assert.fail(`infra: unhandled error — ${message}`);
  });
