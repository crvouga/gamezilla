import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  normalizeVersion,
  parsePins,
  parseSwiftVersion,
  parseXcodeVersion,
  ToolchainError,
} from './native-toolchain';
import {
  currentHost,
  HOSTS,
  hostFilters,
  hostsOf,
  workspaceManifests,
} from './package-hosts';
import { countTestCases } from './swift-task';
import { hostVerifyArgs, MAIN_VERIFY_TASKS } from './turbo-ci-run';
import { summaryProblem } from './xcode-task';

const ROOT = join(import.meta.dirname, '../../..');

describe('toolchain pins', () => {
  test('mise.toml pins Swift and the Xcode that ships it', () => {
    const pins = parsePins(readFileSync(join(ROOT, 'mise.toml'), 'utf8'));
    expect(pins.swift).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pins.xcode).toMatch(/^\d+\.\d+(\.\d+)?$/);
    expect(pins.simulatorRuntime).toMatch(/^\d+\.\d+$/);
    expect(pins.simulatorDevice).not.toBe('');
    // Linux-only and lazy: no Apple runner and no unrelated job downloads it.
    expect(readFileSync(join(ROOT, 'mise.toml'), 'utf8')).toContain(
      `swift = { version = "${pins.swift}", os = ["linux"], lazy = true }`
    );
  });

  test('a missing pin is an error that names it', () => {
    expect(() => parsePins('[tools]\nbun = "1"\n')).toThrow(
      new ToolchainError('mise.toml does not pin [tools] swift.version')
    );
    expect(() =>
      parsePins('[tools]\nswift = { version = "6.4.0" }\n[vars]\n')
    ).toThrow(
      new ToolchainError('mise.toml does not pin [vars] xcode_version')
    );
  });
});

describe('version parsing', () => {
  test("Apple's Swift reports its exact release through the swiftlang tag", () => {
    expect(
      parseSwiftVersion(
        'swift-driver version: 1.168.6 Apple Swift version 6.4 (swiftlang-6.4.0.34.1 clang-2100.3.34.1)\nTarget: arm64-apple-macosx26.0'
      )
    ).toBe('6.4.0');
  });

  test("Linux's Swift reports its version directly", () => {
    expect(
      parseSwiftVersion(
        'Swift version 6.4.1 (swift-6.4.1-RELEASE)\nTarget: x86_64-unknown-linux-gnu'
      )
    ).toBe('6.4.1');
    expect(parseSwiftVersion('Swift version 6.4 (swift-6.4-RELEASE)')).toBe(
      '6.4.0'
    );
    expect(parseSwiftVersion('bash: swift: command not found')).toBeUndefined();
  });

  test('Xcode reports its marketing version', () => {
    expect(parseXcodeVersion('Xcode 27.1\nBuild version 27A9275\n')).toBe(
      '27.1'
    );
    expect(
      parseXcodeVersion('xcode-select: error: tool requires Xcode')
    ).toBeUndefined();
    expect(normalizeVersion('6')).toBe('6.0.0');
  });
});

describe('a native test run that ran nothing is not a pass', () => {
  test('SwiftPM: test cases across the XCTest and Swift Testing reports', () => {
    expect(countTestCases([])).toBe(0);
    expect(
      countTestCases(['<testsuites><testsuite tests="0"/></testsuites>'])
    ).toBe(0);
    expect(
      countTestCases([
        '<testsuite><testcase name="a"/><testcase name="b"></testcase></testsuite>',
        '<testsuite><testcase name="c"/></testsuite>',
      ])
    ).toBe(3);
  });

  test('Xcode: the result bundle records passed tests and no failure', () => {
    expect(
      summaryProblem({
        result: 'Passed',
        totalTestCount: 1,
        passedTests: 1,
        failedTests: 0,
      })
    ).toBeNull();
    expect(
      summaryProblem({ result: 'Passed', totalTestCount: 0, passedTests: 0 })
    ).toBe('no test ran');
    expect(
      summaryProblem({ result: 'Failed', passedTests: 1, failedTests: 1 })
    ).toBe('1 test(s) failed');
    expect(
      summaryProblem({ result: 'Skipped', passedTests: 1, failedTests: 0 })
    ).toBe('the result is Skipped');
  });
});

describe('verification hosts', () => {
  const manifests = workspaceManifests(ROOT);

  test('packages are verified on the hosts their platforms need', () => {
    expect(hostsOf({})).toEqual(['linux']);
    expect(hostsOf({ platforms: ['ios'] })).toEqual(['macos']);
    expect(hostsOf({ platforms: ['linux', 'macos', 'ios'] })).toEqual([
      'linux',
      'macos',
    ]);
    expect(currentHost('darwin')).toBe('macos');
    expect(currentHost('linux')).toBe('linux');
    expect(currentHost('win32')).toBeUndefined();
  });

  test('the Linux gate is every package but the Apple-only ones, with every root-owned gate', () => {
    const args = hostVerifyArgs('linux', manifests);
    expect(args.filter((arg) => !arg.startsWith('--'))).toEqual([
      ...MAIN_VERIFY_TASKS,
    ]);
    expect(args.filter((arg) => arg.startsWith('--'))).toEqual([
      '--filter=./apps/*',
      '--filter=./libs/*',
      '--filter=./pkgs/*',
      '--filter=!@apps/apple-client-swift',
    ]);
  });

  test('the macOS gate is the package-owned gate tasks of the Apple packages', () => {
    const args = hostVerifyArgs('macos', manifests);
    expect(args.some((arg) => arg.includes('#'))).toBe(false);
    expect(args).toContain('test');
    expect(args).toContain('lint');
    expect(hostFilters(manifests, 'macos')).toEqual([
      '--filter=@apps/apple-client-swift',
      '--filter=@pkgs/clock-shared-swift',
    ]);
  });

  test('every host names its CI runner and the key that runner writes', () => {
    expect(HOSTS.linux).toEqual({
      runner: 'ubuntu-24.04',
      platform: 'linux',
      arch: 'x64',
    });
    expect(HOSTS.macos.platform).toBe('darwin');
    const workflow = readFileSync(
      join(ROOT, '.github/workflows/verify-pr.yml'),
      'utf8'
    );
    expect(workflow).toContain(`runs-on: ${HOSTS.macos.runner}`);
  });
});
