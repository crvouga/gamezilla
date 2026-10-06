// @io-wall-ok — retain completed proof diagnostics after the task supervisor kills a checker.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { copyModelEvidence } from './check-model-evidence';

export function preserveInterruptedModels(
  packageDir: string,
  target: string
): void {
  const cache = join(packageDir, '.cache');
  if (!existsSync(cache)) return;
  for (const name of readdirSync(cache).filter((name) =>
    name.startsWith('model-check-')
  ))
    copyModelEvidence(join(cache, name), join(target, 'interrupted', name));
}
