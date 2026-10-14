import { join } from 'node:path';

/** A selected file keeps the runtime setup of its owning package's test task. */
export function testFileCommand(
  file: string,
  script: string
): {
  readonly packagePath: string;
  readonly argv: readonly string[];
} {
  const [tier, name, ...path] = file.split('/');
  if (!['pkgs', 'libs'].includes(tier ?? '') || !name || path.length === 0)
    throw new Error(`Test has no owning package: ${file}`);
  const tokens = script.trim().split(/\s+/);
  if (tokens[0] !== 'bun' || tokens[1] !== 'test')
    throw new Error(`Package test task must use bun test: ${script}`);
  const runtime: string[] = [];
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (
      /^--(?:conditions|preload|timeout|parallel)=/.test(token) ||
      token === '--parallel'
    )
      runtime.push(token);
    else if (
      token === '--conditions' ||
      token === '--preload' ||
      token === '--timeout'
    ) {
      const value = tokens[++i];
      if (!value || value.startsWith('-'))
        throw new Error(`Missing runtime flag value: ${token}`);
      runtime.push(token, value);
    }
  }
  return {
    packagePath: join(tier!, name),
    argv: ['test', ...runtime, `./${path.join('/')}`],
  };
}
