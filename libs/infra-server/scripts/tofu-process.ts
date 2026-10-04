// @io-wall-ok — CLI helper: spawns tofu / conftest.

import type { ConftestRunner } from '@libs/infra-shared/plan-policy';
import { redactInfraOutput } from '@libs/infra-shared/redact-output';

export type ToolResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

const resolved = new Map<string, readonly string[]>();

/**
 * tofu / conftest at the versions pinned in `mise.toml`, whether or not mise
 * is activated in the calling shell (a bare `tofu` is not on PATH there).
 * The binary is resolved once with `mise which` — `mise exec` per call costs
 * ~1 s of startup; until the tool is installed, `mise exec` installs it on
 * first use.
 */
export function pinnedTool(bin: string): string[] {
  let cmd = resolved.get(bin);
  if (cmd === undefined) {
    const which = Bun.spawnSync(['mise', 'which', bin], {
      stdout: 'pipe',
      stderr: 'ignore',
      timeout: 20_000,
      killSignal: 'SIGKILL',
    });
    const path = which.stdout.toString().trim();
    cmd =
      which.exitCode === 0 && path.length > 0
        ? [path]
        : ['mise', 'exec', '--', bin];
    resolved.set(bin, cmd);
  }
  return [...cmd];
}

export function spawnTool(
  bin: string,
  args: readonly string[],
  options: { env: Record<string, string>; stdin?: string; capture?: boolean }
): ToolResult {
  const operation = args.find((arg) => !arg.startsWith('-')) ?? bin;
  const label = `${bin} ${operation}`;
  const timeout = operation === 'apply' ? undefined : 180_000;
  console.log(
    `[infra] ${label}: started${timeout === undefined ? '' : ` (deadline ${timeout}ms)`}`
  );
  const env = { ...process.env, ...options.env };
  const result = Bun.spawnSync([...pinnedTool(bin), ...args], {
    env,
    ...(timeout === undefined ? {} : { timeout, killSignal: 'SIGKILL' }),
    stdin: options.stdin === undefined ? 'ignore' : Buffer.from(options.stdin),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = result.stdout?.toString() ?? '';
  const stderr = result.stderr?.toString() ?? '';
  const safe = (text: string) => redactInfraOutput(text, env);
  if (options.capture !== true) {
    process.stdout.write(safe(stdout));
    process.stderr.write(safe(stderr));
  }
  if (result.exitedDueToTimeout) {
    if (operation !== 'show') process.stderr.write(safe(stdout));
    process.stderr.write(safe(stderr));
    throw new Error(`${label} exceeded ${timeout}ms`);
  }
  console.log(`[infra] ${label}: exited ${result.exitCode}`);
  return {
    status: result.exitCode,
    stdout,
    stderr: safe(stderr),
  };
}

export function tofu(
  args: readonly string[],
  env: Record<string, string>
): number {
  return spawnTool('tofu', args, { env }).status;
}

export const conftest: ConftestRunner = ({ args, stdin }) =>
  spawnTool('conftest', args, { env: {}, stdin, capture: true });

export function fail(message: string): never {
  console.error(`[infra] ${message}`);
  process.exit(1);
}
