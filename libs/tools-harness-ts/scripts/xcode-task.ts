#!/usr/bin/env bun
// @io-wall-ok — Xcode app task entry, run from an Apple app package's directory.
/**
 * `build` and `test` of an Xcode app package (`xcode-task.ts build|test`).
 * The package holds one `<name>.xcodeproj` with a shared `<name>` scheme.
 *
 * - `build`: the app for the iOS Simulator, signed to run locally only
 *   (`CODE_SIGN_IDENTITY = -`, no team), into `.cache/derived-data/`.
 * - `test`: the scheme's tests on a simulator of the pinned device and
 *   runtime, created for this run and deleted after it, so concurrent runs and
 *   a person's own simulators never share a device. Fails when the result
 *   bundle records no passed test.
 *
 * Only macOS with the pinned Xcode can do either; anywhere else this fails
 * and says so, because an Apple build that did not happen is not a pass.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  readPins,
  resolveDeveloperDir,
  resolveSimulator,
  resolveSwift,
  ToolchainError,
  withToolchain,
} from './native-toolchain';
import { currentHost } from './package-hosts';
import { spawnInherit } from './swift-task';

type Command = 'build' | 'test';

type TestSummary = {
  readonly result?: string;
  readonly totalTestCount?: number;
  readonly passedTests?: number;
  readonly failedTests?: number;
};

/** Why a result bundle's summary is not a pass, or null when it is. Pure. */
export function summaryProblem(summary: TestSummary): string | null {
  if ((summary.failedTests ?? 0) > 0)
    return `${summary.failedTests} test(s) failed`;
  if ((summary.passedTests ?? 0) === 0) return 'no test ran';
  if (summary.result !== 'Passed') return `the result is ${summary.result}`;
  return null;
}

function project(dir: string): string {
  const projects = readdirSync(dir).filter((entry) =>
    entry.endsWith('.xcodeproj')
  );
  if (projects.length !== 1)
    throw new ToolchainError(
      `an Xcode app package holds exactly one .xcodeproj; ${dir} has ${projects.length}`
    );
  return projects[0]!;
}

function xcrun(
  args: readonly string[],
  env: NodeJS.ProcessEnv
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync('xcrun', args, { encoding: 'utf8', env });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function main(command: Command): Promise<number> {
  const dir = process.cwd();
  const manifest = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8')
  ) as { readonly name: string; readonly platforms?: unknown };
  const pins = readPins();
  if (currentHost() !== 'macos')
    throw new ToolchainError(
      `${manifest.name} is an Apple app: building it needs macOS with Xcode ${pins.xcode}, and this host is ${process.platform}. Nothing was verified here, and CI does not check it: verify it with \`bun verify\` on a Mac (docs/POLYGLOT.md#ci).`
    );
  const developerDir = resolveDeveloperDir(pins);
  resolveSwift(pins);
  const env = { ...process.env, DEVELOPER_DIR: developerDir };
  const xcodeproj = project(dir);
  const scheme = xcodeproj.replace(/\.xcodeproj$/, '');
  const common = [
    '-project',
    xcodeproj,
    '-scheme',
    scheme,
    '-configuration',
    'Debug',
    // One derived-data tree per Xcode, so a version bump never links
    // against another compiler's objects, and per command, so `build` and
    // `test` can run side by side.
    '-derivedDataPath',
    join('.cache', 'derived-data', `xcode-${pins.xcode}-${command}`),
    '-clonedSourcePackagesDirPath',
    join('.cache', 'source-packages'),
    '-disableAutomaticPackageResolution',
    '-quiet',
    'COMPILER_INDEX_STORE_ENABLE=NO',
  ];
  if (command === 'build')
    return spawnInherit(
      'xcodebuild',
      ['build', ...common, '-destination', 'generic/platform=iOS Simulator'],
      env
    );
  return test({ common, env, scheme, developerDir, pins });
}

async function test(args: {
  readonly common: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly scheme: string;
  readonly developerDir: string;
  readonly pins: ReturnType<typeof readPins>;
}): Promise<number> {
  const { runtime, deviceType } = resolveSimulator(
    args.developerDir,
    args.pins
  );
  const created = xcrun(
    [
      'simctl',
      'create',
      `${args.scheme}-verify-${process.pid}`,
      deviceType,
      runtime,
    ],
    args.env
  );
  if (created.status !== 0)
    throw new ToolchainError(`cannot create a simulator:\n${created.stderr}`);
  const udid = created.stdout.trim();
  const results = join('.cache', 'test-results', `${args.scheme}.xcresult`);
  rmSync(results, { recursive: true, force: true });
  const release = () => {
    xcrun(['simctl', 'shutdown', udid], args.env);
    xcrun(['simctl', 'delete', udid], args.env);
  };
  process.once('exit', release);
  try {
    const status = await spawnInherit(
      'xcodebuild',
      [
        'test',
        ...args.common,
        '-destination',
        `id=${udid}`,
        '-resultBundlePath',
        results,
      ],
      args.env
    );
    if (status !== 0) return status;
    const summary = xcrun(
      ['xcresulttool', 'get', 'test-results', 'summary', '--path', results],
      args.env
    );
    if (summary.status !== 0)
      throw new ToolchainError(`cannot read ${results}:\n${summary.stderr}`);
    const parsed = JSON.parse(summary.stdout) as TestSummary;
    const problem = summaryProblem(parsed);
    if (problem !== null) {
      console.error(`xcode-task: ${problem} (${results})`);
      return 1;
    }
    console.log(
      `xcode-task: ${parsed.passedTests} test(s) passed on ${args.pins.simulatorDevice}, iOS ${args.pins.simulatorRuntime}`
    );
    return 0;
  } finally {
    release();
    process.off('exit', release);
  }
}

if (import.meta.main) {
  const command = process.argv[2];
  if (command !== 'build' && command !== 'test') {
    console.error('usage: xcode-task.ts build|test');
    process.exit(1);
  }
  await withToolchain('xcode-task', () => main(command));
}
