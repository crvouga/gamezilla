// @io-wall-ok — invoke the publication entry with the existing injected process environment.
export async function reportCommand(
  root: string,
  env: NodeJS.ProcessEnv,
  args: string[]
): Promise<void> {
  const child = Bun.spawn(
    ['bun', 'run', 'libs/harness/scripts/report-publish.ts', ...args],
    { cwd: root, env, stdout: 'inherit', stderr: 'inherit' }
  );
  const status = await child.exited;
  if (status !== 0) throw new Error(`Report ${args[0]} failed (${status})`);
}
