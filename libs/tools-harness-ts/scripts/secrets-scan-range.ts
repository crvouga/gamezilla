// @io-wall-ok — reads git history (composition helper for turbo-ci-run / verify-secrets)
import { execFileSync } from 'node:child_process';

/** The env var `turbo-ci-run` exports and `@libs/tools-harness-ts#verify:secrets` hashes on. */
export const SECRETS_RANGE_ENV = 'VERIFY_SECRETS_RANGE';

/** Local runs diff against this ref, the same base a pull request targets. */
const DEFAULT_BASE_REF = 'origin/main';

type Git = (args: readonly string[]) => string | undefined;

/**
 * The commits a secrets scan must cover, as a `git log` range of full shas:
 * `<merge-base>..<head>`, i.e. exactly the commits the branch adds.
 *
 * Both ends are content addresses, so the range is a pure cache key: a local
 * `bun verify` on a branch and the Verify run on its pull request resolve the
 * same range and share the turbo cache entry, and main moving under an open
 * PR does not invalidate it. A head with nothing of its own (main after a
 * merge) scans just its tip commit.
 */
export function secretsScanRange(
  env: NodeJS.ProcessEnv,
  git: Git = wallGit
): string {
  const isPullRequest =
    (env['GH_EVENT'] ?? env['GITHUB_EVENT_NAME']) === 'pull_request';
  const prHead = env['PR_HEAD']?.trim() ?? '';
  const prBase = env['PR_BASE']?.trim() ?? '';
  const head =
    isPullRequest && prHead !== '' ? prHead : git(['rev-parse', 'HEAD']);
  if (head === undefined) throw new Error('secrets scan: no HEAD commit');
  const baseRef = isPullRequest && prBase !== '' ? prBase : DEFAULT_BASE_REF;
  const base = git(['merge-base', baseRef, head]);
  if (base === undefined || base === head) return `${head}~1..${head}`;
  return `${base}..${head}`;
}

function wallGit(args: readonly string[]): string | undefined {
  try {
    const out = execFileSync('git', [...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out === '' ? undefined : out;
  } catch {
    return undefined;
  }
}
