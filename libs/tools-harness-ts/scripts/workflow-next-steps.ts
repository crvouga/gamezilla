/**
 * The "next" block a failed run's summary ends with: commands a person or an
 * agent can paste to reach the root problem, in the order to run them.
 */
export type FailedRun = {
  readonly repo: string;
  readonly runId: string;
  readonly server: string;
  /** The environment a Release or Health job ran against, or empty. */
  readonly secretsEnv: string;
};

export function nextStepsMarkdown(run: FailedRun): string {
  if (run.repo === '' || run.runId === '') return '';
  const lines = [
    '### Next (copy and run)',
    '',
    '```sh',
    '# the failed jobs, with links',
    `gh run view ${run.runId} --repo ${run.repo} --json jobs --jq '.jobs[] | select(.conclusion == "failure") | {name, url}'`,
    "# the failing steps' output",
    `gh run view ${run.runId} --repo ${run.repo} --log-failed | tail -200`,
  ];
  if (run.secretsEnv !== '') {
    lines.push(
      '# screenshots, page HTML and console of each failed critical journey',
      `bun run libs/secrets-server-ts/scripts/secrets-run.ts -- bun run libs/tools-harness-ts/scripts/ci-artifacts.ts --run ${run.runId} download-all critical-journeys- artifacts`
    );
  }
  lines.push(
    '```',
    '',
    `Playbook: ${run.server}/${run.repo}/blob/main/.agents/skills/ci-workflows-green/SKILL.md`
  );
  return lines.join('\n');
}
