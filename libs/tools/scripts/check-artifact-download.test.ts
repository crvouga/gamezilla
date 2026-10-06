import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ArtifactClient } from '@actions/artifact';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { artifactSource, downloadEvidence } from './check-artifact-download';

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
          { id: 11, name: 'check-evidence-16', size: 10 },
          { id: 12, name: 'check-plan', size: 10 },
        ],
      };
    },
    downloadArtifact: async (id, options) => {
      expect(options).toEqual({ path: '/transfers', findBy });
      downloaded.push(id);
      return { downloadPath: '/transfers' };
    },
  };
  await downloadEvidence('check-evidence-', '/transfers', findBy, client);
  expect(downloaded).toEqual([11]);
  const workflow = Bun.YAML.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.github/workflows/check.yml'),
      'utf8'
    )
  ) as { env: Record<string, string> };
  expect(workflow.env['GH_TOKEN']).toBe('${{ github.token }}');
});

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
