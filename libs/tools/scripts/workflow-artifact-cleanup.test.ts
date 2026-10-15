import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const workflow = Bun.YAML.parse(
  readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/check-pr.yml'),
    'utf8'
  )
) as { jobs: Record<string, { steps: { name?: string; run?: string }[] }> };
const cleanup = workflow.jobs['check-end']!.steps.find(
  (step) => step.name === 'Delete transfer artifacts'
)!.run!;

function runCleanup(ids: readonly number[], listingCode = 0, deleteCode = 0) {
  return spawnSync(
    'bash',
    [
      '-c',
      `
      gh() {
        if [[ "$2" == "--paginate" ]]; then
          if [[ -n "$ARTIFACT_IDS" ]]; then printf '%s\\n' "$ARTIFACT_IDS"; fi
          if [[ "$LISTING_CODE" != "0" ]]; then
            printf '%s\\n' 'unexpected end of JSON input' >&2
          fi
          return "$LISTING_CODE"
        fi
        printf '%s\\n' "$4"
        return "$DELETE_CODE"
      }
      ${cleanup}
      `,
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: process.env['PATH'],
        GITHUB_REPOSITORY: 'example/repo',
        GITHUB_RUN_ID: '38790601955',
        ARTIFACT_IDS: ids.join('\n'),
        LISTING_CODE: String(listingCode),
        DELETE_CODE: String(deleteCode),
      },
    }
  );
}

// regression: check-artifact-cleanup-partial-pagination
test('a truncated artifact listing fails before deleting its partial results', () => {
  const result = runCleanup([12007505699], 1);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('unexpected end of JSON input');
  expect(result.stdout).toBe('');
});

test('cleanup deletes every listed artifact exactly once, including an empty list', () => {
  assertProperty(
    'workflow artifact cleanup',
    fc.property(
      fc.array(fc.nat({ max: 1_000_000 }), { maxLength: 150 }),
      (ids) => {
        const result = runCleanup(ids);
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toBe(
          ids
            .map((id) => `repos/example/repo/actions/artifacts/${id}\n`)
            .join('')
        );
      }
    )
  );
});

test('an artifact deletion error still fails the cleanup', () => {
  expect(runCleanup([12007505699], 0, 1).status).toBe(1);
});
