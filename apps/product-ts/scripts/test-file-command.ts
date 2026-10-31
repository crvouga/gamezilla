/**
 * Repo-relative test paths may come from Windows (`libs\x\tests\a.test.ts`)
 * or POSIX tooling; either separator names the same segments.
 */
function pathSegments(file: string): string[] {
  return file.split(/[\\/]/);
}

/** `<tier>/<name>` of the package that owns a repo-relative test file. */
export function owningPackagePath(file: string): string {
  return pathSegments(file).slice(0, 2).join('/');
}

/** A selected file keeps the runtime setup of its owning package's test task. */
export function testFileCommand(
  file: string,
  script: string
): {
  readonly packagePath: string;
  readonly argv: readonly string[];
} {
  const [tier, name, ...path] = pathSegments(file);
  if (!['pkgs', 'libs'].includes(tier ?? '') || !name || path.length === 0)
    throw new Error(`Test has no owning package: ${file}`);
  const tokens = script.trim().split(/\s+/);
  if (tokens[0] !== 'bun' || tokens[1] !== 'test')
    throw new Error(`Package test task must use bun test: ${script}`);
  const runtime: string[] = [];
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (
      /^--(?:conditions|preload|timeout|parallel|tsconfig-override)=/.test(
        token
      ) ||
      token === '--parallel'
    )
      runtime.push(token);
    else if (
      token === '--tsconfig-override' ||
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
    packagePath: `${tier}/${name}`,
    argv: ['test', ...runtime, `./${path.join('/')}`],
  };
}
