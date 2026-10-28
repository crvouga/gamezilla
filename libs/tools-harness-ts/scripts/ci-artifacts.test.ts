import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  collectFiles,
  commonRoot,
  deleteArtifacts,
  downloadArtifact,
  listArtifacts,
  uploadArtifact,
} from './ci-artifacts';

const REPO = join(import.meta.dirname, '../../..');

function workspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'ci-artifacts-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
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

async function roundTrip(
  files: Record<string, string>,
  patterns: readonly string[]
): Promise<Record<string, string>> {
  const root = workspace(files);
  const out = mkdtempSync(join(tmpdir(), 'ci-artifacts-out-'));
  try {
    const store = new ObjectStoreImplInMemory();
    const collected = collectFiles(root, patterns);
    await uploadArtifact({ store, runId: '7', name: 'a', ...collected });
    await downloadArtifact({ store, runId: '7', name: 'a', directory: out });
    return tree(out);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
    removeTree(out, { whenLocked: 'leave' });
  }
}

test('one file uploads by its base name, as actions/upload-artifact does', async () => {
  expect(
    await roundTrip(
      { '.cache/verify-ci/plan.payload': 'plan', '.cache/verify-ci/x': 'no' },
      ['.cache/verify-ci/plan.payload']
    )
  ).toEqual({ 'plan.payload': 'plan' });
});

test('patterns keep the path below the directory every pattern searches', async () => {
  expect(
    await roundTrip(
      {
        'apps/a/.cache/harness-report/r/traces/1.ndjson': 'a1',
        'libs/b/.cache/harness-report/r/traces/2.ndjson': 'b2',
        'libs/b/.cache/harness-report/r/other.json': 'skip',
      },
      [
        'apps/*/.cache/harness-report/*/traces/*.ndjson',
        'libs/*/.cache/harness-report/*/traces/*.ndjson',
        'pkgs/*/.cache/harness-report/*/traces/*.ndjson',
      ]
    )
  ).toEqual({
    'apps/a/.cache/harness-report/r/traces/1.ndjson': 'a1',
    'libs/b/.cache/harness-report/r/traces/2.ndjson': 'b2',
  });
  expect(
    await roundTrip(
      {
        '.cache/verify-ci/cached/results-1.tar.gz': 'r1',
        '.cache/verify-ci/cached/evidence-1.tar.gz': 'e1',
      },
      ['.cache/verify-ci/cached/results-*.tar.gz']
    )
  ).toEqual({ 'results-1.tar.gz': 'r1' });
});

test('a directory uploads every file under it, hidden ones included', async () => {
  expect(
    await roundTrip(
      {
        'apps/p/.cache/critical-journeys/j/.page.html': 'html',
        'apps/p/.cache/critical-journeys/j/shot.png': 'png',
      },
      ['apps/p/.cache/critical-journeys/']
    )
  ).toEqual({ 'j/.page.html': 'html', 'j/shot.png': 'png' });
});

test('nothing matched uploads nothing', () => {
  const root = workspace({});
  try {
    expect(
      collectFiles(root, ['.turbo/runs/*.json', 'missing/']).files
    ).toEqual([]);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

test('uploading a name again replaces it rather than merging', async () => {
  const store = new ObjectStoreImplInMemory();
  const put = async (files: Record<string, string>) => {
    const root = workspace(files);
    try {
      await uploadArtifact({
        store,
        runId: '1',
        name: 'verify-plan',
        ...collectFiles(root, Object.keys(files)),
      });
    } finally {
      removeTree(root, { whenLocked: 'leave' });
    }
  };
  await put({ 'old.json': 'old' });
  await put({ 'new.json': 'new' });
  expect(await store.listKeys('1/')).toEqual(['1/verify-plan/new.json']);
});

// regression: github-artifact-download-attempt-selection
test('every artifact of a run downloads into its own directory, and only that run', async () => {
  const store = new ObjectStoreImplInMemory();
  const bytes = (text: string) => new TextEncoder().encode(text);
  const big = 'x'.repeat(1_048_577);
  for (const shard of ['0', '1'])
    await store.put(
      `42/observability-traces-42-${shard}/trace.txt`,
      bytes(`${shard}:${big}`),
      'text/plain'
    );
  await store.put(
    '43/observability-traces-43-0/trace.txt',
    bytes('other'),
    'text/plain'
  );
  expect(
    await listArtifacts({ store, runId: '42', prefix: 'observability-traces-' })
  ).toEqual(['observability-traces-42-0', 'observability-traces-42-1']);
  const out = mkdtempSync(join(tmpdir(), 'ci-artifacts-all-'));
  try {
    for (const name of await listArtifacts({
      store,
      runId: '42',
      prefix: 'observability-traces-',
    }))
      await downloadArtifact({
        store,
        runId: '42',
        name,
        directory: join(out, name),
      });
    expect(tree(out)).toEqual({
      'observability-traces-42-0/trace.txt': `0:${big}`,
      'observability-traces-42-1/trace.txt': `1:${big}`,
    });
  } finally {
    removeTree(out, { whenLocked: 'leave' });
  }
  expect(
    await deleteArtifacts({ store, runId: '42', prefix: 'observability-' })
  ).toBe(2);
  expect(await store.listKeys()).toEqual([
    '43/observability-traces-43-0/trace.txt',
  ]);
});

test('names and runs cannot escape their prefix', async () => {
  const store = new ObjectStoreImplInMemory();
  for (const name of ['', '../x', 'a/b', '.hidden'])
    await expect(
      downloadArtifact({ store, runId: '1', name, directory: tmpdir() })
    ).rejects.toThrow('Invalid artifact name');
  for (const runId of ['', '1/2', '../1'])
    await expect(
      listArtifacts({ store, runId, prefix: 'verify-' })
    ).rejects.toThrow('Invalid run ID');
});

test('the common root is the deepest directory every path shares', () => {
  assertProperty(
    'ci-artifacts-common-root',
    fc.property(
      fc.array(fc.array(fc.constantFrom('a', 'b', 'c'), { maxLength: 4 }), {
        minLength: 1,
        maxLength: 5,
      }),
      (paths) => {
        const absolute = paths.map((parts) => join('/', 'r', ...parts));
        const root = commonRoot(absolute);
        for (const path of absolute)
          expect(path === root || path.startsWith(`${root}${sep}`)).toBe(true);
      }
    )
  );
});

// regression: artifact-storage-quota-exhausted
// regression: github-download-artifact-node20
test('no workflow keeps an artifact in GitHub storage, and the bucket expires every object within a week', () => {
  const workflows = join(REPO, '.github/workflows');
  for (const file of readdirSync(workflows)) {
    const text = readFileSync(join(workflows, file), 'utf8');
    expect({
      file,
      uses: /actions\/(upload|download)-artifact@/.test(text),
    }).toEqual({
      file,
      uses: false,
    });
  }
  const global = JSON.parse(
    readFileSync(
      join(REPO, 'libs/infra-shared-ts/tofu/global.tfvars.json'),
      'utf8'
    )
  ) as { ci_artifacts: { retention_days: number } };
  expect(global.ci_artifacts.retention_days).toBeLessThanOrEqual(7);
  const fleet = readFileSync(
    join(REPO, 'libs/infra-shared-ts/tofu/stacks/fleet/ci-artifacts.tf'),
    'utf8'
  );
  expect(fleet).toContain(
    'resource "cloudflare_r2_bucket_lifecycle" "ci_artifacts"'
  );
  expect(fleet).toContain('max_age = var.ci_artifacts.retention_days * 86400');
});

// regression: verify-artifact-cleanup-partial-pagination
test('a failed listing deletes nothing', async () => {
  const store = new ObjectStoreImplInMemory();
  await store.put('1/verify-plan/plan.payload', new Uint8Array([1]), 'x');
  let deleted = 0;
  const failing = {
    ...store,
    listKeys: async (): Promise<readonly string[]> => {
      throw new Error('unexpected end of XML input');
    },
    deleteMany: async () => {
      deleted += 1;
    },
  } as unknown as ObjectStoreImplInMemory;
  await expect(
    deleteArtifacts({ store: failing, runId: '1', prefix: 'verify-' })
  ).rejects.toThrow('unexpected end of XML input');
  expect(deleted).toBe(0);
  expect(await store.listKeys()).toEqual(['1/verify-plan/plan.payload']);
});

// regression: verify-artifact-property-shell-starts
test('cleanup deletes every listed transfer exactly once, including none, and keeps the rest', async () => {
  await assertProperty(
    'ci-artifacts-delete',
    fc.asyncProperty(
      fc.uniqueArray(fc.nat({ max: 1_000_000 }), { maxLength: 150 }),
      async (ids) => {
        const store = new ObjectStoreImplInMemory();
        const bytes = new Uint8Array([1]);
        for (const id of ids)
          await store.put(
            `5/verify-evidence-${String(id)}/e.tar.gz`,
            bytes,
            'x'
          );
        await store.put('5/observability-traces-5-0/t.ndjson', bytes, 'x');
        await store.put('6/verify-plan/plan.payload', bytes, 'x');
        expect(
          await deleteArtifacts({ store, runId: '5', prefix: 'verify-' })
        ).toBe(ids.length);
        expect(await store.listKeys()).toEqual([
          '5/observability-traces-5-0/t.ndjson',
          '6/verify-plan/plan.payload',
        ]);
      }
    ),
    { examples: [[[]]] }
  );
});
