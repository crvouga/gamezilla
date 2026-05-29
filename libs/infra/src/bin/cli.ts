import { main } from '../cli/main';
import { fail } from '../cli/lib/fmt';
import { GitHubActionsPlatform } from '../cli/platform/github-actions';
import { LocalPlatform } from '../cli/platform/local';

/**
 * Infra CLI targets Doppler config `prd` unless `DOPPLER_CONFIG` is set.
 * Unset/empty would follow `~/.doppler` defaults and can break `doppler secrets get`.
 */
const dopplerConfigRaw = process.env['DOPPLER_CONFIG'];
if (typeof dopplerConfigRaw !== 'string' || dopplerConfigRaw.trim() === '') {
  process.env['DOPPLER_CONFIG'] = 'prd';
}

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
    // IMPORTANT: do not re-throw from here (e.g. via `assert.fail`). Re-throwing
    // in a `.catch` becomes an unhandledRejection, which races with and can
    // suppress the lock-release path in `runInfraCommand` — exactly the
    // "deploy failed and left the lock held" bug we're guarding against.
    const message = e instanceof Error ? e.message : String(e);
    fail('infra', message);
    if (e instanceof Error && e.stack) {
      console.error(e.stack);
    }
    process.exit(1);
  });
