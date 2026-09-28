// @io-wall-ok — CLI helper: spawns tofu / conftest.
import type { ConftestRunner } from '@libs/infra/public/plan-policy';

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
  const result = Bun.spawnSync([...pinnedTool(bin), ...args], {
    env: { ...process.env, ...options.env },
    stdin: options.stdin === undefined ? 'ignore' : Buffer.from(options.stdin),
    stdout: options.capture === true ? 'pipe' : 'inherit',
    stderr: options.capture === true ? 'pipe' : 'inherit',
  });
  return {
    status: result.exitCode,
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
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
