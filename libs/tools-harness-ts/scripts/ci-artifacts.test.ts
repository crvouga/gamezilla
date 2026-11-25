import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { ArtifactsApi } from './ci-artifacts';
import {
  deleteArtifacts,
  downloadArtifact,
  listArtifacts,
  readArtifactZip,
} from './ci-artifacts';
import { fakeArtifactsApi } from './ci-artifacts-fake';

const REPO = join(import.meta.dirname, '../../..');
const WORKFLOWS = join(REPO, '.github/workflows');
const UPLOAD =
  'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9';
const DOWNLOAD =
  'actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333';

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  'continue-on-error'?: boolean;
  with?: Record<string, unknown>;
};

function workflowSteps(): { file: string; step: Step }[] {
  return readdirSync(WORKFLOWS).flatMap((file) => {
    const workflow = Bun.YAML.parse(
      readFileSync(join(WORKFLOWS, file), 'utf8')
    ) as { jobs: Record<string, { steps?: Step[] }> };
    return Object.values(workflow.jobs).flatMap((job) =>
      (job.steps ?? []).map((step) => ({ file, step }))
    );
  });
}

function tree(directory: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);
        return [
          path.slice(directory.length + 1).replaceAll('\\', '/'),
          readFileSync(path, 'utf8'),
        ];
      })
      .sort(([a], [b]) => (a! < b! ? -1 : 1))
  );
}

// regression: github-artifact-download-attempt-selection
test('a rerun’s newest attempt of a name wins, every artifact downloads into its own directory, and only that run', async () => {
  const api = fakeArtifactsApi([
    {
      runId: '42',
      id: 11,
      name: 'observability-traces-42-0',
      files: { 'trace.txt': 'old' },
    },
    {
      runId: '42',
      id: 12,
      name: 'observability-traces-42-0',
      files: { 'trace.txt': 'new' },
    },
    {
      runId: '42',
      id: 13,
      name: 'observability-traces-42-1',
      files: { 'a/trace.txt': '1' },
    },
    {
      runId: '42',
      id: 14,
      name: 'observability-traces-42-2',
      files: { x: 'gone' },
      expired: true,
    },
    {
      runId: '43',
      id: 15,
      name: 'observability-traces-43-0',
      files: { 'trace.txt': 'other' },
    },
  ]);
  const names = await listArtifacts({
    api,
    runId: '42',
    prefix: 'observability-traces-',
  });
  expect(names).toEqual([
    'observability-traces-42-0',
    'observability-traces-42-1',
  ]);
  const out = mkdtempSync(join(tmpdir(), 'ci-artifacts-all-'));
  try {
    for (const name of names)
      expect(
        await downloadArtifact({
          api,
          runId: '42',
          name,
          directory: join(out, name),
        })
      ).toBe(true);
    expect(tree(out)).toEqual({
      'observability-traces-42-0/trace.txt': 'new',
      'observability-traces-42-1/a/trace.txt': '1',
    });
    expect(
      await downloadArtifact({
        api,
        runId: '42',
        name: 'verify-plan',
        directory: join(out, 'missing'),
      })
    ).toBe(false);
    expect(existsSync(join(out, 'missing'))).toBe(false);
  } finally {
    removeTree(out, { whenLocked: 'leave' });
  }
});

test('names and runs cannot escape their scope', async () => {
  const api = fakeArtifactsApi([]);
  for (const name of ['', '../x', 'a/b', '.hidden'])
    await expect(
      downloadArtifact({ api, runId: '1', name, directory: tmpdir() })
    ).rejects.toThrow('Invalid artifact name');
  for (const runId of ['', '1/2', '../1'])
    await expect(
      listArtifacts({ api, runId, prefix: 'verify-' })
    ).rejects.toThrow('Invalid run ID');
});

// regression: artifact-storage-quota-exhausted
// regression: github-download-artifact-node20
// regression: ci-artifact-upload-r2-same-object-throttle
// regression: nightly-browser-reports-not-uploaded
test('every artifact step is a pinned node24 action that replaces its name, keeps hidden report paths and expires within days', () => {
  // GitHub artifact storage is free only for a public repository; a private
  // one filled its quota and stopped every Verify run.
  const global = JSON.parse(
    readFileSync(
      join(REPO, 'libs/infra-shared-ts/tofu/global.tfvars.json'),
      'utf8'
    )
  ) as { github: { settings: { visibility: string } } };
  expect(global.github.settings.visibility).toBe('public');
  const steps = workflowSteps();
  const uploads = steps.filter(({ step }) =>
    step.uses?.startsWith('actions/upload-artifact@')
  );
  expect(uploads.length).toBeGreaterThan(0);
  for (const { file, step } of uploads) {
    const name = String(step.with?.['name']);
    const transfer = /^(verify-(plan|results|evidence)|release-verdict)/.test(
      name
    );
    expect({ file, name, uses: step.uses, with: step.with }).toEqual({
      file,
      name,
      uses: UPLOAD,
      with: {
        ...step.with,
        'retention-days': transfer ? 1 : 3,
        overwrite: true,
        'include-hidden-files': true,
        'if-no-files-found': 'ignore',
      },
    });
    // Diagnostic uploads never fail the verification they describe.
    expect({
      name,
      bestEffort: step['continue-on-error'] === true,
    }).toEqual({
      name,
      bestEffort: /^(observability-traces|turbo-summary|health-alerts)-/.test(
        name
      ),
    });
  }
  for (const { step } of steps.filter(({ step }) =>
    step.uses?.startsWith('actions/download-artifact@')
  ))
    expect(step.uses).toBe(DOWNLOAD);
  // The browser report keeps whole report directories, not just traces.
  const browser = uploads.find(({ step }) =>
    String(step.with?.['name']).startsWith('verify-nightly-browser-')
  );
  expect(String(browser?.step.with?.['path'])).toContain(
    'apps/*/.cache/harness-report'
  );
  // No workflow reaches the retired R2 bucket.
  for (const file of readdirSync(WORKFLOWS))
    expect({
      file,
      bucket:
        /CI_ARTIFACTS_|ci-artifacts-run|ci-artifacts\.ts (--best-effort )?upload/.test(
          readFileSync(join(WORKFLOWS, file), 'utf8')
        ),
    }).toEqual({ file, bucket: false });
});

// regression: verify-artifact-cleanup-partial-pagination
test('a failed listing deletes nothing', async () => {
  const fake = fakeArtifactsApi([
    { runId: '1', id: 1, name: 'verify-plan', files: { 'plan.payload': 'p' } },
  ]);
  const failing: ArtifactsApi = {
    ...fake,
    list: async () => {
      throw new Error('gh api --paginate failed: unexpected end of JSON input');
    },
  };
  await expect(
    deleteArtifacts({ api: failing, runId: '1', prefix: 'verify-' })
  ).rejects.toThrow('unexpected end of JSON input');
  expect(fake.removed).toEqual([]);
});

// regression: verify-artifact-property-shell-starts
test('cleanup deletes every listed transfer exactly once, including none, and keeps the rest', async () => {
  await assertProperty(
    'ci-artifacts-delete',
    fc.asyncProperty(
      fc.uniqueArray(fc.nat({ max: 1_000_000 }), { maxLength: 150 }),
      async (ids) => {
        const api = fakeArtifactsApi([
          ...ids.map((id) => ({
            runId: '5',
            id: id + 10,
            name: `verify-evidence-${String(id)}`,
            files: { 'e.tar.gz': 'e' },
          })),
          { runId: '5', id: 1, name: 'observability-traces-5-0', files: {} },
          { runId: '6', id: 2, name: 'verify-plan', files: {} },
        ]);
        expect(
          await deleteArtifacts({ api, runId: '5', prefix: 'verify-' })
        ).toBe(ids.length);
        expect([...api.removed].sort((a, b) => a - b)).toEqual(
          ids.map((id) => id + 10).sort((a, b) => a - b)
        );
        expect(
          api
            .live()
            .map(({ name }) => name)
            .sort()
        ).toEqual(['observability-traces-5-0', 'verify-plan']);
      }
    ),
    { examples: [[[]]] }
  );
});

// regression: release-verification-artifact-http-503
test('a gateway outage during the prerequisite ZIP transfer preserves the shard input', async () => {
  const response = Buffer.from('prerequisite ZIP');
  const sleeps: number[] = [];
  const read = () => {
    if (!sleeps.length) throw new Error('gh: HTTP 503');
    return response;
  };
  const pause = async (ms: number) => sleeps.push(ms);
  expect(await readArtifactZip(read, pause)).toBe(response);
  expect(sleeps).toEqual([1000]);
  await expect(
    readArtifactZip(() => {
      throw new Error('gh: HTTP 404');
    }, pause)
  ).rejects.toThrow('404');
  expect(sleeps).toEqual([1000]);
});
