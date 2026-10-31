import { expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import {
  apalacheServerArgs,
  privateQuintHome,
  resolveApalache,
  verifyEnv,
} from '@pkgs/quint-server-ts/apalache';
import {
  killGroup,
  runQuint,
  showsServerLog,
} from '@pkgs/quint-server-ts/run-quint';

// regression: quint-invalid-limit-mode-starts-checker
test('invalid limit configuration is rejected before creating checker files or processes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'quint-invalid-limits-'));
  const cwd = join(root, 'checker');
  try {
    await expect(
      runQuint({
        args: ['-e', 'process.exit(0)'],
        cwd,
        env: { VERIFY_TIME_LIMITS: 'typo' },
        timeoutMs: 1000,
      })
    ).rejects.toThrow('must be on or off');
    expect(existsSync(cwd)).toBe(false);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: verify-quint-silent-exit
test.each(['on', 'off'])(
  'a checker terminated after the JVM notice retains its exit signal and stderr (limits %s)',
  async (mode) => {
    const cwd = mkdtempSync(join(tmpdir(), 'quint-signal-'));
    const args = [
      '-e',
      "console.error('Picked up JAVA_TOOL_OPTIONS: -XX:ActiveProcessorCount=4'); process.kill(process.pid, 'SIGTERM')",
    ];
    try {
      const result = await runQuint({
        args,
        cwd,
        env: { VERIFY_TIME_LIMITS: mode },
        timeoutMs: 1000,
      });
      // The status this OS gives the terminated process: the signal on
      // POSIX, a nonzero exit code on Windows, which has no signals.
      const native = await exitStatus(args);
      expect(native).toEqual(
        process.platform === 'win32'
          ? { code: expect.any(Number), signal: null }
          : { code: null, signal: 'SIGTERM' }
      );
      expect(native.code).not.toBe(0);
      expect({ code: result.code, signal: result.signal }).toEqual(native);
      expect(result.timedOut).toBe(false);
      expect(result.output).toContain('Picked up JAVA_TOOL_OPTIONS');
    } finally {
      removeTree(cwd, { whenLocked: 'leave' });
    }
  }
);

/** The exit status of `args` run directly, as the OS reports it. */
function exitStatus(
  args: readonly string[]
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
}

test('Windows kills the checker tree with taskkill, and an exited checker is not an error', () => {
  const calls: (readonly [string, readonly string[]])[] = [];
  killGroup(4321, 'win32', (file, args) => {
    calls.push([file, args]);
    throw new Error('ERROR: The process "4321" not found.');
  });
  killGroup(undefined, 'win32', (file, args) => calls.push([file, args]));
  expect(calls).toEqual([['taskkill', ['/PID', '4321', '/T', '/F']]]);
});

test('the Apalache server runs the JVM command its own launcher builds', () => {
  const base = { home: '/opt/apalache', port: 4242, tmpdir: '/w/tmp/SANY1' };
  const tail = [
    '-Djava.io.tmpdir=/w/tmp/SANY1',
    '-jar',
    join('/opt/apalache', 'lib', 'apalache.jar'),
    'server',
    '--port=4242',
  ];
  expect(apalacheServerArgs({ ...base, env: {} })).toEqual([
    '-Xmx4096m',
    '-XX:+UseG1GC',
    '-XX:G1PeriodicGCInterval=600000',
    '-XX:+G1PeriodicGCInvokesConcurrent',
    ...tail,
  ]);
  expect(
    apalacheServerArgs({
      ...base,
      env: {
        JVM_ARGS: ' -Xmx2g -Dx=1 ',
        JVM_GC_ARGS: '-XX:+UseParallelGC -Xmx4096m -Xms128m',
      },
    })
  ).toEqual([
    '-Xmx2g',
    '-Dx=1',
    '-XX:+UseParallelGC',
    '-Xmx4096m',
    '-Xms128m',
    ...tail,
  ]);
});

test('Quint shows the server log unless its verbosity is below the default', () => {
  expect(showsServerLog(['verify', 'm.qnt'])).toBe(true);
  expect(showsServerLog(['compile', '--verbosity', '0'])).toBe(false);
  expect(showsServerLog(['verify', '--verbosity', '3'])).toBe(true);
});

test('Windows keeps one PATH key, with the pinned JVM first', () => {
  const env = verifyEnv({
    env: { Path: 'C:\\Windows', OTHER: 'x' },
    quintHome: 'C:\\q',
    platform: 'win32',
  });
  expect(
    Object.keys(env).filter((key) => key.toUpperCase() === 'PATH')
  ).toEqual(['PATH']);
  expect(env['PATH']?.endsWith('C:\\Windows')).toBe(true);
  expect(env['OTHER']).toBe('x');
  const posix = verifyEnv({
    env: { PATH: '/usr/bin', Path: 'kept' },
    quintHome: '/q',
    platform: 'linux',
  });
  expect(posix['Path']).toBe('kept');
  expect(posix['PATH']?.endsWith('/usr/bin')).toBe(true);
});

/** Apalache servers started for the check in `cwd` (their SANY tmpdir is under it). */
function serverProcesses(cwd: string): string[] {
  if (process.platform === 'win32') return [];
  const ps = Bun.spawnSync(['ps', '-axww', '-o', 'command='], {
    stdout: 'pipe',
  });
  return ps.stdout
    .toString()
    .split('\n')
    .filter((line) => line.includes('apalache.jar') && line.includes(cwd));
}

function apalacheHome(): string {
  const pinned = resolveApalache(process.env);
  if (!('home' in pinned)) throw new Error(pinned.error);
  return pinned.home;
}

/** A stand-in for Quint: connects to the endpoint it was given, then waits. */
const CONNECTS = `
  const at = process.argv.indexOf('--server-endpoint');
  const [host, port] = process.argv[at + 1].split(':');
  const socket = require('node:net').connect({ host, port: Number(port) });
  socket.on('connect', () => { console.log('connected ' + port); socket.destroy(); setTimeout(() => {}, Number(process.env.HOLD_MS)); });
  socket.on('error', (error) => { console.error(String(error)); process.exit(3); });
`;

// regression: quint-apalache-server-outlives-check
test.each([
  ['Quint exits', 0, 60_000],
  ['the deadline passes', 30_000, 1_500],
])(
  'the check owns its Apalache server and kills it when %s',
  async (_, holdMs, timeoutMs) => {
    const cwd = mkdtempSync(join(tmpdir(), 'quint-server-'));
    try {
      // A file, not `-e`: Bun takes `--server-endpoint` after `-e` as its own.
      const script = join(cwd, 'quint.js');
      writeFileSync(script, CONNECTS);
      const run = await runQuint({
        args: [script],
        cwd,
        env: {
          ...verifyEnv({ env: process.env, quintHome: privateQuintHome(cwd) }),
          HOLD_MS: String(holdMs),
          VERIFY_TIME_LIMITS: 'on',
        },
        timeoutMs,
        apalacheHome: apalacheHome(),
      });
      const port = /connected (\d+)/.exec(run.stdout)?.[1];
      if (holdMs === 0) {
        expect(run).toMatchObject({ code: 0, timedOut: false });
        expect(port).toBeDefined();
      } else {
        expect(run.timedOut).toBe(true);
      }
      expect(serverProcesses(cwd)).toEqual([]);
    } finally {
      removeTree(cwd, { whenLocked: 'leave' });
    }
  },
  90_000
);

// regression: quint-quiet-server-startup-diagnostics
test('a server that cannot start retains its error even in quiet mode', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'quint-no-server-'));
  try {
    const run = await runQuint({
      args: ['-e', 'console.log("quint ran")', '--verbosity', '0'],
      cwd,
      env: verifyEnv({ env: process.env, quintHome: privateQuintHome(cwd) }),
      timeoutMs: 60_000,
      apalacheHome: join(cwd, 'no-apalache'),
    });
    expect(run.code).toBe(1);
    expect(run.stdout).not.toContain('quint ran');
    expect(run.output).toContain('did not accept connections');
    expect(run.output).toContain('Unable to access jarfile');
  } finally {
    removeTree(cwd, { whenLocked: 'leave' });
  }
});
