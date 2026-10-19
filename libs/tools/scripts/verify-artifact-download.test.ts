import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArtifactClient } from '@actions/artifact';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { artifactSource, downloadEvidence } from './verify-artifact-download';

// regression: github-artifact-download-missing-runtime-token
test('shell transfers use the workflow token for both listing and downloading', async () => {
  const env = {
    GH_TOKEN: 'workflow-token',
    GITHUB_REPOSITORY: 'crvouga/gamezilla',
    GITHUB_RUN_ID: '37512663922',
  };
  // A normal GitHub run step has no ACTIONS_RUNTIME_TOKEN.
  const findBy = artifactSource(env);
  const downloaded: number[] = [];
  const client: Pick<ArtifactClient, 'listArtifacts' | 'downloadArtifact'> = {
    listArtifacts: async (options) => {
      expect(options).toEqual({ latest: true, findBy });
      return {
        artifacts: [
          { id: 11, name: 'verify-evidence-16', size: 10 },
          { id: 12, name: 'verify-plan', size: 10 },
        ],
      };
    },
    downloadArtifact: async (id, options) => {
      expect(options).toEqual({ path: '/transfers', findBy });
      downloaded.push(id);
      return { downloadPath: '/transfers' };
    },
  };
  await downloadEvidence({
    prefix: 'verify-evidence-',
    directory: '/transfers',
    findBy,
    client,
    consumer: {
      consume: async () => {},
      release: async () => {},
    },
  });
  expect(downloaded).toEqual([11]);
  const workflow = Bun.YAML.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
      'utf8'
    )
  ) as { env: Record<string, string> };
  expect(workflow.env['GH_TOKEN']).toBe('${{ github.token }}');
});

// regression: reports-ci-aggregation-disk
test('the 32-shard evidence set is consumed before the next archive is downloaded', async () => {
  await boundedTransfer(Array.from({ length: 32 }, () => 0));
});

test('bounded transfers preserve independent artifacts after consumption failures', async () => {
  await assertProperty(
    'evidence-transfer-bounded-storage',
    fc.asyncProperty(
      fc.array(fc.constantFrom(0, 1, 2), { minLength: 1, maxLength: 80 }),
      boundedTransfer
    )
  );
});

async function boundedTransfer(fails: number[]): Promise<void> {
  let resident = 0;
  let peak = 0;
  let current = 0;
  const attempted: number[] = [];
  const client: Pick<ArtifactClient, 'listArtifacts' | 'downloadArtifact'> = {
    listArtifacts: async () => ({
      artifacts: fails.map((_, id) => ({
        id,
        name: `verify-evidence-${id}`,
        size: 1,
      })),
    }),
    downloadArtifact: async (id) => {
      current = id;
      attempted.push(id);
      peak = Math.max(peak, ++resident);
      if (fails[id] === 2) throw new Error(`partial download: ${id}`);
      return { downloadPath: '/transfers' };
    },
  };
  let verdict: unknown;
  try {
    await downloadEvidence({
      prefix: 'verify-evidence-',
      directory: '/transfers',
      findBy: artifactSource({
        GH_TOKEN: 'token',
        GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_RUN_ID: '1',
      }),
      client,
      consumer: {
        consume: async () => {
          await Promise.resolve();
          if (fails[current] === 1) throw new Error(String(current));
        },
        release: async () => {
          resident--;
        },
      },
    });
  } catch (error) {
    verdict = error;
  }
  expect(attempted).toEqual(fails.map((_, id) => id));
  expect(peak).toBe(1);
  expect(resident).toBe(0);
  if (fails.some(Boolean)) {
    expect(verdict).toBeInstanceOf(AggregateError);
    expect((verdict as AggregateError).errors).toHaveLength(
      fails.filter(Boolean).length
    );
  } else expect(verdict).toBeUndefined();
}

test('artifact source preserves the exact repository and run', () => {
  assertProperty(
    'public artifact requests are scoped to their run',
    fc.property(
      fc.stringMatching(/^[a-z]{1,12}$/),
      fc.stringMatching(/^[a-z]{1,12}$/),
      fc.integer({ min: 1, max: 1_000_000_000_000 }),
      (owner, repo, run) => {
        expect(
          artifactSource({
            GITHUB_TOKEN: 'job-token',
            GITHUB_REPOSITORY: `${owner}/${repo}`,
            GITHUB_RUN_ID: String(run),
          })
        ).toEqual({
          token: 'job-token',
          repositoryOwner: owner,
          repositoryName: repo,
          workflowRunId: run,
        });
      }
    )
  );
});

test('missing workflow coordinates fail without falling back to internal auth', () => {
  const env = {
    GH_TOKEN: 'job-token',
    GITHUB_REPOSITORY: 'crvouga/gamezilla',
    GITHUB_RUN_ID: '37512663922',
  };
  for (const key of Object.keys(env))
    expect(() => artifactSource({ ...env, [key]: '' })).toThrow(
      'Artifact transfer requires'
    );
  expect(() => artifactSource({ ...env, GITHUB_RUN_ID: '-1' })).toThrow();
  expect(() =>
    artifactSource({ ...env, GITHUB_REPOSITORY: 'owner/repo/extra' })
  ).toThrow();
});
