#!/usr/bin/env bun
// @io-wall-ok — SwiftPM task entry, run from a Swift package's directory.
/**
 * `tc` and `test` of a SwiftPM package (`swift-task.ts tc|test`): find the
 * pinned Swift (`native-toolchain.ts`), refuse a host the package does not
 * build for, run SwiftPM, and hand back its exit code. Turborepo owns the
 * order; SwiftPM resolves only what `Package.resolved` already pins
 * (`--disable-automatic-resolution`) and builds under `.cache/swiftpm/`.
 *
 * `test` fails when no test ran: a test target whose tests SwiftPM never
 * found must not read as a pass.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  readPins,
  resolveSwift,
  ToolchainError,
  withToolchain,
} from './native-toolchain';
import { currentHost, hostsOf } from './package-hosts';

type Command = 'tc' | 'test';

/**
 * One build directory per compiler and host, so a toolchain bump or a
 * second host never links against another's objects.
 */
function scratchPath(swift: string): string {
  return join(
    '.cache',
    'swiftpm',
    `${process.platform}-${process.arch}-swift-${swift}`
  );
}

/** `<testcase` elements across xunit reports. Pure, for tests. */
export function countTestCases(reports: readonly string[]): number {
  return reports.reduce(
    (total, report) => total + (report.match(/<testcase\b/g)?.length ?? 0),
    0
  );
}

export function spawnInherit(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv
): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    process.on('SIGINT', forward);
    process.on('SIGTERM', forward);
    child.on('error', () => resolve(1));
    child.on('close', (code) => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      resolve(code ?? 1);
    });
  });
}

function requireHost(dir: string): void {
  const manifest = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8')
  ) as { readonly name: string; readonly platforms?: unknown };
  const host = currentHost();
  const hosts = hostsOf(manifest);
  if (host === undefined || !hosts.includes(host))
    throw new ToolchainError(
      `${manifest.name} builds for ${JSON.stringify(manifest.platforms)}, verified on ${hosts.join(' and ')}; this host is ${process.platform}. Its verdict comes from CI (docs/POLYGLOT.md#ci).`
    );
}

async function main(command: Command): Promise<number> {
  const dir = process.cwd();
  requireHost(dir);
  const pins = readPins();
  const swift = resolveSwift(pins);
  const scratch = scratchPath(pins.swift);
  const xunit = join(scratch, 'xunit.xml');
  // SwiftPM writes Swift Testing's results beside XCTest's.
  const reports = [xunit, join(scratch, 'xunit-swift-testing.xml')];
  for (const file of reports) rmSync(file, { force: true });
  const status = await spawnInherit(
    swift.command,
    [
      ...swift.prefix,
      ...(command === 'tc'
        ? ['build', '--build-tests']
        : ['test', '--xunit-output', xunit]),
      '--scratch-path',
      scratch,
      '--disable-automatic-resolution',
    ],
    swift.env
  );
  if (status !== 0 || command !== 'test') return status;
  const ran = countTestCases(
    reports.filter(existsSync).map((file) => readFileSync(file, 'utf8'))
  );
  if (ran > 0) return 0;
  console.error(
    'swift-task: `swift test` passed without running a test — add tests, or drop the `test` script'
  );
  return 1;
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command !== 'tc' && command !== 'test') {
    console.error('usage: swift-task.ts tc|test');
    process.exit(1);
  }
  await withToolchain('swift-task', () => main(command));
}
