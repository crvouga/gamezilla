import { join } from 'node:path';

const PBT_GLOB = new Bun.Glob('**/*.pbt.test.ts');

export async function discoverPbtTests(repoRoot: string): Promise<string[]> {
  const files: string[] = [];
  for (const base of ['pkgs', 'libs'] as const) {
    for await (const rel of PBT_GLOB.scan({
      cwd: join(repoRoot, base),
      onlyFiles: true,
    })) {
      files.push(join(base, rel));
    }
  }
  return files.sort();
}
