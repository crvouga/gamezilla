import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTION = join(
  import.meta.dirname,
  '../../../.depot/actions/secrets-auth/impl-infisical/action.yml'
);
const AUDIENCE = 'https://github.com/gamezilla-org';
type Step = { run?: string; uses?: string; with?: Record<string, string> };

function steps(): Step[] {
  const action = Bun.YAML.parse(readFileSync(ACTION, 'utf8')) as {
    runs: { steps: Step[] };
  };
  return action.runs.steps;
}

// regression: depot-action-oidc-missing-audience
// regression: workflow-oidc-test-stdout-socket
test.each([
  'https://example.test/token',
  'https://example.test/token?job=check',
  'https://example.test/token?',
])('Infisical requests the trusted audience from %s', (requestUrl) => {
  const sequence = steps();
  const fetchIndex = sequence.findIndex((step) =>
    step.uses?.startsWith('Infisical/secrets-action@')
  );
  const preparation = sequence
    .slice(0, fetchIndex)
    .find((step) => step.run?.includes('ACTIONS_ID_TOKEN_REQUEST_URL'));
  expect(preparation).toBeDefined();
  const result = spawnSync(
    'bash',
    [
      '-c',
      `
    set -euo pipefail
    auth_env_file="$(mktemp)"
    trap 'rm -f "$auth_env_file"' EXIT
    export GITHUB_ENV="$auth_env_file"
    ${preparation!.run!}
    cat "$auth_env_file"
  `,
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: process.env['PATH'],
        ACTIONS_ID_TOKEN_REQUEST_URL: requestUrl,
      },
    }
  );
  expect(result.status, result.stderr).toBe(0);
  const normalized =
    result.stdout.trim().replace(/^ACTIONS_ID_TOKEN_REQUEST_URL=/, '') ||
    requestUrl;
  const audience = sequence[fetchIndex]?.with?.['oidc-audience'];
  expect(audience).toBe('https://github.com/${{ github.repository_owner }}');
  // The pinned action's OIDC client appends an ampersand unconditionally.
  const url = new URL(`${normalized}&audience=${encodeURIComponent(AUDIENCE)}`);
  expect(url.searchParams.getAll('audience')).toEqual([AUDIENCE]);
  expect(url.pathname).toBe(new URL(requestUrl).pathname);
  expect(url.searchParams.get('job')).toBe(
    new URL(requestUrl).searchParams.get('job')
  );
});
