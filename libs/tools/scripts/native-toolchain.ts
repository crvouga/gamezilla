// @io-wall-ok — locates the pinned native toolchains for the Swift task wrappers.
/**
 * The Swift and Xcode toolchains, exactly as `mise.toml` pins them, or an
 * error that says how to get them. Never a different compiler.
 *
 * - **Linux:** `swift` is a lazy, Linux-only mise tool. `mise exec` installs
 *   it the first time a Swift task runs, so a runner or laptop that never
 *   builds Swift never downloads it.
 * - **macOS:** Swift is the one inside Xcode — Apple's SDKs, simulator and
 *   `xcodebuild` come only with Xcode — so the pin is Xcode's version
 *   (`[vars] xcode_version`), and its Swift must equal the Linux pin. An
 *   explicit `DEVELOPER_DIR` is used as given; otherwise the active developer
 *   directory, or else the installed `/Applications/Xcode*.app` whose version
 *   matches, is handed to every child process as `DEVELOPER_DIR`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { currentHost } from './package-hosts';

const REPO_ROOT = join(import.meta.dirname, '../../..');

export type ToolchainPins = {
  readonly swift: string;
  readonly xcode: string;
  readonly simulatorDevice: string;
  readonly simulatorRuntime: string;
};

type MiseToml = {
  readonly tools?: { readonly swift?: { readonly version?: string } };
  readonly vars?: Readonly<Record<string, unknown>>;
};

/** The native pins in `mise.toml` text. Pure, for tests. */
export function parsePins(text: string): ToolchainPins {
  const config = Bun.TOML.parse(text) as MiseToml;
  const vars = config.vars ?? {};
  const read = (value: unknown, what: string): string => {
    if (typeof value !== 'string' || value === '')
      throw new ToolchainError(`mise.toml does not pin ${what}`);
    return value;
  };
  return {
    swift: read(config.tools?.swift?.version, '[tools] swift.version'),
    xcode: read(vars['xcode_version'], '[vars] xcode_version'),
    simulatorDevice: read(
      vars['ios_simulator_device'],
      '[vars] ios_simulator_device'
    ),
    simulatorRuntime: read(
      vars['ios_simulator_runtime'],
      '[vars] ios_simulator_runtime'
    ),
  };
}

export function readPins(root: string = REPO_ROOT): ToolchainPins {
  return parsePins(readFileSync(join(root, 'mise.toml'), 'utf8'));
}

/** A missing or mismatched toolchain: the message is the fix. */
export class ToolchainError extends Error {}

/** `6.4` → `6.4.0`, so a short and a long spelling compare equal. */
export function normalizeVersion(version: string): string {
  const parts = version.split('.');
  while (parts.length < 3) parts.push('0');
  return parts.join('.');
}

/**
 * The compiler version `swift --version` reports. Apple's toolchain prints
 * its marketing version plus the exact `swiftlang-X.Y.Z…` tag; Linux prints
 * `Swift version X.Y.Z`.
 */
export function parseSwiftVersion(output: string): string | undefined {
  const apple = /swiftlang-(\d+\.\d+\.\d+)/.exec(output)?.[1];
  if (apple !== undefined) return apple;
  const plain = /Swift version (\d+\.\d+(?:\.\d+)?)/.exec(output)?.[1];
  return plain === undefined ? undefined : normalizeVersion(plain);
}

/** `Xcode 27.1\nBuild version 27A9275` → `27.1`. */
export function parseXcodeVersion(output: string): string | undefined {
  return /^Xcode (\d+(?:\.\d+)*)/m.exec(output)?.[1];
}

type Run = (
  command: string,
  args: readonly string[],
  env?: NodeJS.ProcessEnv
) => { readonly status: number | null; readonly stdout: string };

const run: Run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { encoding: 'utf8', env });
  return {
    status: result.error === undefined ? result.status : null,
    stdout: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
};

function xcodeVersionAt(developerDir: string): string | undefined {
  const result = run('xcrun', ['xcodebuild', '-version'], {
    ...process.env,
    DEVELOPER_DIR: developerDir,
  });
  return result.status === 0 ? parseXcodeVersion(result.stdout) : undefined;
}

function installedXcodes(): readonly string[] {
  const applications = '/Applications';
  if (!existsSync(applications)) return [];
  return readdirSync(applications)
    .filter((entry) => /^Xcode.*\.app$/.test(entry))
    .sort()
    .map((entry) => join(applications, entry, 'Contents', 'Developer'));
}

/** The developer directory of the pinned Xcode. */
export function resolveDeveloperDir(
  pins: ToolchainPins = readPins(),
  env: NodeJS.ProcessEnv = process.env
): string {
  const explicit = env['DEVELOPER_DIR']?.trim();
  if (explicit) {
    const version = xcodeVersionAt(explicit);
    if (version === pins.xcode) return explicit;
    throw new ToolchainError(
      `DEVELOPER_DIR=${explicit} is Xcode ${version ?? '(none)'}, but mise.toml pins Xcode ${pins.xcode}. Unset DEVELOPER_DIR or point it at Xcode ${pins.xcode}.`
    );
  }
  const selected = run('xcode-select', ['-p']);
  const active = selected.status === 0 ? selected.stdout.trim() : '';
  if (active !== '' && xcodeVersionAt(active) === pins.xcode) return active;
  const found = installedXcodes().map((dir) => ({
    dir,
    version: xcodeVersionAt(dir),
  }));
  const match = found.find((xcode) => xcode.version === pins.xcode);
  if (match !== undefined) return match.dir;
  const seen = found.map((x) => `${x.version ?? '?'} (${x.dir})`).join(', ');
  throw new ToolchainError(
    [
      `Xcode ${pins.xcode} is required (mise.toml [vars] xcode_version) and is not installed.`,
      active.includes('CommandLineTools')
        ? `The active developer directory is the Command Line Tools (${active}), which has no iOS SDK.`
        : `Active developer directory: ${active || '(none)'}.`,
      `Installed: ${seen || 'no /Applications/Xcode*.app'}.`,
      `Install it (\`mise exec xcodes@latest -- xcodes install ${pins.xcode}\`, or from developer.apple.com), then rerun.`,
    ].join('\n')
  );
}

/** How to run `swift` on this host, after checking it is the pinned one. */
export type SwiftInvocation = {
  readonly command: string;
  readonly prefix: readonly string[];
  readonly env: NodeJS.ProcessEnv;
};

export function resolveSwift(
  pins: ToolchainPins = readPins(),
  env: NodeJS.ProcessEnv = process.env
): SwiftInvocation {
  const host = currentHost();
  const invocation: SwiftInvocation | undefined =
    host === 'macos'
      ? {
          command: 'xcrun',
          prefix: ['swift'],
          env: { ...env, DEVELOPER_DIR: resolveDeveloperDir(pins, env) },
        }
      : host === 'linux'
        ? { command: 'mise', prefix: ['exec', '--', 'swift'], env }
        : undefined;
  if (invocation === undefined)
    throw new ToolchainError(
      `Swift tasks run on Linux or macOS; this host is ${process.platform}.`
    );
  const probe = run(
    invocation.command,
    [...invocation.prefix, '--version'],
    invocation.env
  );
  if (probe.status !== 0)
    throw new ToolchainError(
      host === 'linux'
        ? `Cannot run the pinned Swift ${pins.swift} through mise (\`mise exec -- swift --version\` failed):\n${probe.stdout}\nInstall mise (README.md#laptop) and run \`mise install swift\`.`
        : `Cannot run Xcode's swift:\n${probe.stdout}`
    );
  const version = parseSwiftVersion(probe.stdout);
  if (version !== normalizeVersion(pins.swift))
    throw new ToolchainError(
      host === 'macos'
        ? `Xcode ${pins.xcode} ships Swift ${version ?? '(unknown)'}, but mise.toml pins swift ${pins.swift}. Pin the Swift that Xcode ${pins.xcode} ships, so Linux and Apple builds use one compiler.`
        : `mise ran Swift ${version ?? '(unknown)'}, but mise.toml pins swift ${pins.swift}. Run \`mise install swift\`.`
    );
  return invocation;
}

/** The pinned simulator's runtime and device type identifiers. */
export function resolveSimulator(
  developerDir: string,
  pins: ToolchainPins = readPins()
): { readonly runtime: string; readonly deviceType: string } {
  const listed = run('xcrun', ['simctl', 'list', 'runtimes', '-j'], {
    ...process.env,
    DEVELOPER_DIR: developerDir,
  });
  if (listed.status !== 0)
    throw new ToolchainError(
      `\`simctl list runtimes\` failed:\n${listed.stdout}`
    );
  const { runtimes } = JSON.parse(listed.stdout) as {
    runtimes: {
      identifier: string;
      version: string;
      platform?: string;
      name: string;
      isAvailable: boolean;
      supportedDeviceTypes: { name: string; identifier: string }[];
    }[];
  };
  const runtime = runtimes.find(
    (candidate) =>
      candidate.isAvailable &&
      candidate.name.startsWith('iOS ') &&
      candidate.version === pins.simulatorRuntime
  );
  if (runtime === undefined)
    throw new ToolchainError(
      `The iOS ${pins.simulatorRuntime} simulator runtime is not installed (mise.toml [vars] ios_simulator_runtime). Installed: ${
        runtimes
          .filter((r) => r.name.startsWith('iOS '))
          .map((r) => r.version)
          .join(', ') || 'none'
      }. Install it with \`xcodebuild -downloadPlatform iOS\` from Xcode ${pins.xcode}.`
    );
  const device = runtime.supportedDeviceTypes.find(
    (type) => type.name === pins.simulatorDevice
  );
  if (device === undefined)
    throw new ToolchainError(
      `iOS ${pins.simulatorRuntime} has no "${pins.simulatorDevice}" simulator (mise.toml [vars] ios_simulator_device). It offers: ${runtime.supportedDeviceTypes.map((t) => t.name).join(', ')}.`
    );
  return { runtime: runtime.identifier, deviceType: device.identifier };
}

/** Run a toolchain step, printing a `ToolchainError` as the fix it is. */
export async function withToolchain(
  label: string,
  body: () => Promise<number> | number
): Promise<never> {
  try {
    process.exit(await body());
  } catch (error) {
    if (!(error instanceof ToolchainError)) throw error;
    console.error(`${label}: ${error.message}`);
    process.exit(1);
  }
}
