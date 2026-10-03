// @io-wall-ok — transfer the public model-report interface after failed checks.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function copyModelEvidence(source: string, target: string): void {
  if (!existsSync(source)) return;
  const files = new Set<string>();
  for (const pattern of [
    'evidence/**',
    '*.json',
    '**/tlc-output.txt',
    '**/*.itf.json',
  ])
    for (const name of new Bun.Glob(pattern).scanSync({
      cwd: source,
      onlyFiles: true,
      followSymlinks: false,
    }))
      files.add(name);
  for (const name of files) {
    const destination = join(target, name);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(source, name), destination);
  }
}
