import { expect, test } from 'bun:test';
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { REPORT_READY } from '@libs/harness/report-ready';
import { createReportPublisher } from './check-report-stream';

const TASK = '@libs/example#test:spec:0';
const TURBO = join(import.meta.dirname, '../../../node_modules/.bin/turbo');

async function run(
  root: string,
  cache = 'local:rw'
): Promise<{ status: number; published: string[] }> {
  const plan = JSON.parse(
    execFileSync(TURBO, ['run', TASK, '--dry=json', `--cache=${cache}`], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TURBO_TOKEN: '', TURBO_TEAM: '' },
    })
  ) as { tasks: { taskId: string; hash: string }[] };
  const child = spawn(
    TURBO,
    ['run', TASK, '--json', '--output-logs=full', `--cache=${cache}`],
    {
      cwd: root,
      env: {
        ...process.env,
        TURBO_TOKEN: '',
        TURBO_TEAM: '',
        TURBO_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const published: string[] = [];
  const logs: string[] = [];
  const publisher = createReportPublisher(plan.tasks, {
    async publish(id) {
      expect(existsSync(join(root, 'packages/example/report.ready'))).toBe(
        true
      );
      published.push(id);
    },
    log: (line) => logs.push(line),
  });
  const lines = createInterface({ input: child.stdout! });
  lines.on('line', (line) => publisher.line(line));
  child.stderr?.on('data', (value) => logs.push(String(value)));
  const status = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
  try {
    await publisher.finish(status !== 0);
  } catch (error) {
    throw new Error(logs.join('\n'), { cause: error });
  }
  return { status, published };
}

// regression: report-uncached-task-hash
test('real Turbo streams completed, restored and uncached reports exactly once, including red suites', async () => {
  const root = mkdtempSync(join(tmpdir(), 'check-report-turbo-'));
  try {
    const pkg = join(root, 'packages/example');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        private: true,
        packageManager: `bun@${Bun.version}`,
        workspaces: ['packages/*'],
      })
    );
    writeFileSync(join(root, 'bun.lock'), '');
    writeFileSync(
      join(root, 'turbo.json'),
      JSON.stringify({
        tasks: {
          'test:spec:0': { inputs: ['emit.ts'], outputs: ['report.ready'] },
        },
      })
    );
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({
        name: '@libs/example',
        scripts: { 'test:spec:0': 'bun run emit.ts' },
      })
    );
    const source = `import { writeFileSync } from 'node:fs';\nwriteFileSync('report.ready', 'complete');\nconsole.log('${REPORT_READY}');\n`;
    writeFileSync(join(pkg, 'emit.ts'), source);
    expect(await run(root)).toEqual({ status: 0, published: [TASK] });
    rmSync(join(pkg, 'report.ready'));
    expect(await run(root)).toEqual({ status: 0, published: [TASK] });
    expect(await run(root, 'local:w')).toEqual({
      status: 0,
      published: [TASK],
    });
    writeFileSync(join(pkg, 'emit.ts'), `${source}process.exit(1);\n`);
    expect(await run(root)).toEqual({ status: 1, published: [TASK] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
