// @io-wall-ok — CLI helper: spawns tofu / conftest.
import type { ConftestRunner } from '@libs/infra/public/plan-policy';

export type ToolResult = {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
};

export function spawnTool(
  bin: string,
  args: readonly string[],
  options: { env: Record<string, string>; stdin?: string; capture?: boolean }
): ToolResult {
  const result = Bun.spawnSync([bin, ...args], {
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
