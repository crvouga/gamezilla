/**
 * Whether the infra CLI should use interactive prompts (Clack).
 * False in CI and any non-TTY context so scripts and GitHub Actions stay non-interactive.
 */
export function isHumanInteractiveSession(): boolean {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }
  if (isCiLikeEnvironment()) {
    return false;
  }
  return true;
}

function isCiLikeEnvironment(): boolean {
  const e = process.env;
  if (e['CI'] === 'true' || e['CI'] === '1') return true;
  if (e['GITHUB_ACTIONS'] === 'true') return true;
  if (e['GITLAB_CI'] === 'true') return true;
  if (e['CIRCLECI'] === 'true') return true;
  if (e['CONTINUOUS_INTEGRATION'] === 'true') return true;
  if (e['BUILDKITE'] === 'true') return true;
  return false;
}
