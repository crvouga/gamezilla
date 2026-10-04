// @io-wall-ok — runs the Alloy CLI (a JVM child process) and reads its receipt from disk.
/**
 * Run Alloy 6 on a model's text: `java -jar alloy.jar exec -t json`, which
 * runs every `check` and `run` in the file (or those `command` matches, a
 * glob) and writes `receipt.json` (which commands ran, which found an
 * instance, the model's sigs) beside each instance as Alloy prints it. The jar is `ALLOY_JAR`, else the one mise
 * pins (`mise where http:alloy`); java is `JAVA_HOME/bin/java`, else `java`
 * on `PATH`, else mise's. The solver (SAT4J) is deterministic, so a verdict
 * is a function of the model text.
 *
 * A JVM starts in about a second: batch every command of a model, and every
 * snapshot of an adapter, into one call.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { CommandResult } from '@pkgs/alloy-shared/receipt';
import { parseReceipt, solutionSummary } from '@pkgs/alloy-shared/receipt';
import { modelSigs } from '@pkgs/alloy-shared/sigs';
import type { SigInfo } from '@pkgs/alloy-shared/sigs';

/** Longer than any model or snapshot batch should take, even on a loaded CI box. */
export const ALLOY_TIMEOUT_MS = 120_000;

const INSTALL_HINT =
  'run `mise install` (Alloy 6 and Java are pinned in mise.toml), or set ALLOY_JAR and JAVA_HOME';

type Toolchain = { readonly java: string; readonly jar: string };

let toolchain: Toolchain | null = null;

function miseWhere(tool: string): string | null {
  const result = spawnSync('mise', ['where', tool], { encoding: 'utf8' });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  const dir = result.stdout.trim();
  return dir.length === 0 ? null : dir;
}

function resolveJar(): string {
  const fromEnv = process.env['ALLOY_JAR'];
  const dir = fromEnv === undefined ? miseWhere('http:alloy') : null;
  const jar = fromEnv ?? (dir === null ? null : join(dir, 'alloy.jar'));
  if (jar === null || !existsSync(jar)) {
    throw new Error(
      `alloy: no Alloy jar${jar === null ? '' : ` at ${jar}`} — ${INSTALL_HINT}`
    );
  }
  return jar;
}

function resolveJava(): string {
  const home = process.env['JAVA_HOME'];
  if (home !== undefined && home.length > 0) {
    const java = join(home, 'bin', 'java');
    if (existsSync(java)) return java;
    throw new Error(
      `alloy: JAVA_HOME has no bin/java (${java}) — ${INSTALL_HINT}`
    );
  }
  const onPath = Bun.which('java');
  if (onPath !== null) return onPath;
  const dir = miseWhere('java');
  if (dir !== null && existsSync(join(dir, 'bin', 'java'))) {
    return join(dir, 'bin', 'java');
  }
  throw new Error(`alloy: no java on PATH — ${INSTALL_HINT}`);
}

/** The java binary and Alloy jar the engine runs, resolved once. */
export function alloyToolchain(): Toolchain {
  toolchain ??= { jar: resolveJar(), java: resolveJava() };
  return toolchain;
}

export type ExecAlloyOptions = {
  /** The model text (with any snapshot predicates appended). */
  readonly source: string;
  /** File stem the source is written as; Alloy's messages name it. */
  readonly name: string;
  /**
   * Where the `.als` and Alloy's output go, kept for inspection. Default: a
   * fresh directory under the OS temp dir, removed afterwards.
   */
  readonly workDir?: string;
  /** Run only the commands this glob matches (`snapshot_*`). Default: all. */
  readonly command?: string;
};

export type ExecAlloyResult = {
  readonly commands: readonly CommandResult[];
  readonly sigs: readonly SigInfo[];
};

/** Alloy's error text without the Java stack frames under it. */
function alloyMessage(stderr: string): string {
  return stderr
    .split('\n')
    .filter((line) => !/^\s+at\s/.test(line))
    .join('\n')
    .trim();
}

/** Alloy prints each instance it found as `<command>-solution-0.txt`. */
function withInstance(command: CommandResult, outDir: string): CommandResult {
  const file = join(outDir, `${command.name}-solution-0.txt`);
  if (!command.sat || !existsSync(file)) return command;
  return { ...command, instance: solutionSummary(readFileSync(file, 'utf8')) };
}

function runJvm(options: ExecAlloyOptions, dir: string): ExecAlloyResult {
  const { java, jar } = alloyToolchain();
  const file = join(dir, `${options.name.replace(/[^\w.-]+/g, '-')}.als`);
  const outDir = join(dir, 'out');
  writeFileSync(file, options.source);
  const result = spawnSync(
    java,
    [
      '-Djava.awt.headless=true',
      '-jar',
      jar,
      'exec',
      '--force',
      '--quiet',
      '--type',
      'text',
      '--output',
      outDir,
      ...(options.command === undefined ? [] : ['--command', options.command]),
      file,
    ],
    { encoding: 'utf8', timeout: ALLOY_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error !== undefined || result.signal !== null) {
    const why =
      result.signal === null
        ? String(result.error)
        : `killed by ${result.signal}`;
    throw new Error(
      `alloy exec ${file} did not finish within ${String(ALLOY_TIMEOUT_MS / 1000)} s (${why})`
    );
  }
  const receipt = join(outDir, 'receipt.json');
  if (result.status !== 0 || !existsSync(receipt)) {
    throw new Error(
      [
        `alloy exec ${file} failed (exit ${String(result.status)}):`,
        alloyMessage(result.stderr),
        result.stdout.trim(),
      ]
        .filter((part) => part.length > 0)
        .join('\n')
    );
  }
  const parsed = parseReceipt(JSON.parse(readFileSync(receipt, 'utf8')));
  return {
    commands: parsed.commands.map((command) => withInstance(command, outDir)),
    sigs: modelSigs(parsed.sigs, options.source),
  };
}

/**
 * Write the source, run Alloy on it once, and return each command's result
 * and the model's sigs. Throws with Alloy's own message on a syntax or type
 * error, or when any command could not be solved.
 */
export function execAlloy(options: ExecAlloyOptions): ExecAlloyResult {
  if (options.workDir !== undefined) {
    mkdirSync(options.workDir, { recursive: true });
    return runJvm(options, options.workDir);
  }
  const dir = mkdtempSync(join(tmpdir(), 'alloy-'));
  try {
    return runJvm(options, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const PROBE = 'alloy_sigs_probe';

/**
 * The model's sigs without running any of its commands: one JVM on the model
 * plus an empty probe command. Use the sigs {@link execAlloy} already
 * returned when the model has been checked.
 */
export function probeSigs(options: {
  readonly source: string;
  readonly name: string;
  readonly workDir?: string;
}): readonly SigInfo[] {
  return execAlloy({
    ...options,
    source: `${options.source}\nrun ${PROBE} {} for 0\n`,
    command: PROBE,
  }).sigs;
}
