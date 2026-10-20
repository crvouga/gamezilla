import { afterEach, expect, test } from 'bun:test';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const workflow = Bun.YAML.parse(
  readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
    'utf8'
  )
) as { jobs: Record<string, { steps: { name?: string; run?: string }[] }> };
const cleanup = workflow.jobs['verify-end']!.steps.find(
  (step) => step.name === 'Delete transfer artifacts'
)!.run!;

const ghMock = `
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
`;

const baseEnv = {
  PATH: process.env['PATH'],
  GITHUB_REPOSITORY: 'example/repo',
  GITHUB_RUN_ID: '38790601955',
};

function runCleanup(ids: readonly number[], listingCode = 0, deleteCode = 0) {
  return spawnSync('bash', ['-c', `${ghMock}\n${cleanup}`], {
    encoding: 'utf8',
    env: {
      ...baseEnv,
      ARTIFACT_IDS: ids.join('\n'),
      LISTING_CODE: String(listingCode),
      DELETE_CODE: String(deleteCode),
    },
  });
}

/** Keep the actual workflow shell, with one process for all generated inputs. */
function cleanupSession() {
  const child = spawn(
    'bash',
    [
      '-c',
      `
    ${ghMock}
    cleanup_case() { ${cleanup}
    }
    while IFS= read -r count; do
      ARTIFACT_IDS=''
      for ((n=0; n<count; n++)); do
        IFS= read -r id
        ARTIFACT_IDS+="$id"$'\\n'
      done
      cleanup_case
      cleanup_status=$?
      printf '__cleanup_end__:%s\\n' "$cleanup_status"
    done
  `,
    ],
    { env: { ...baseEnv, LISTING_CODE: '0', DELETE_CODE: '0' } }
  );
  let diagnostic = '';
  child.stderr.on('data', (data: Buffer) => {
    diagnostic += data.toString();
  });
  child.once('error', (error) => {
    diagnostic += error.message;
  });
  const closed = new Promise<void>((resolve) =>
    child.once('close', () => resolve())
  );
  const output = createInterface({ input: child.stdout });
  const lines = output[Symbol.asyncIterator]();
  let stopped = false;
  return {
    run: async (ids: readonly number[]) => {
      if (stopped) throw new Error('Cleanup session is closed');
      child.stdin.write(
        [String(ids.length), ...ids.map(String), ''].join('\n')
      );
      const received: string[] = [];
      for (;;) {
        const line = await lines.next();
        if (line.done)
          throw new Error(
            `Cleanup shell exited before its verdict: ${diagnostic}`
          );
        if (line.value.startsWith('__cleanup_end__:'))
          return {
            status: Number(line.value.slice('__cleanup_end__:'.length)),
            stdout: received.join(''),
            stderr: diagnostic,
          };
        received.push(`${line.value}\n`);
      }
    },
    close: async (): Promise<void> => {
      if (!stopped) {
        stopped = true;
        child.stdin.end();
        output.close();
        child.kill();
      }
      await closed;
    },
  };
}

let activeSession: ReturnType<typeof cleanupSession> | null = null;
afterEach(async () => {
  const session = activeSession;
  activeSession = null;
  await session?.close();
});

// regression: verify-artifact-cleanup-partial-pagination
test('a truncated artifact listing fails before deleting its partial results', () => {
  const result = runCleanup([12007505699], 1);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('unexpected end of JSON input');
  expect(result.stdout).toBe('');
});

// regression: verify-artifact-property-shell-starts
// Nightly seed 419327699, 200 samples, shrunk input []: per-case process startup exceeded 5s.
test('cleanup deletes every listed artifact exactly once, including an empty list', async () => {
  const shell = cleanupSession();
  activeSession = shell;
  try {
    await assertProperty(
      'workflow artifact cleanup',
      fc.asyncProperty(
        fc.array(fc.nat({ max: 1_000_000 }), { maxLength: 150 }),
        async (ids) => {
          const result = await shell.run(ids);
          expect(result.status, result.stderr).toBe(0);
          expect(result.stdout).toBe(
            ids
              .map((id) => `repos/example/repo/actions/artifacts/${id}\n`)
              .join('')
          );
        }
      ),
      { examples: [[[]]] }
    );
  } finally {
    activeSession = null;
    await shell.close();
  }
});

test('an artifact deletion error still fails the cleanup', () => {
  expect(runCleanup([12007505699], 0, 1).status).toBe(1);
});
