// @io-wall-ok — CLI helper: writes the resolved var files OpenTofu reads.
/**
 * Writes `resolvedVarFiles()` under `varsDir` (the tofu cache), the files
 * every `-var-file` names. Each file is written beside itself and renamed
 * into place, so a concurrent run never reads a half-written one.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { TofuPaths } from '@libs/infra-shared-ts/tofu-command';
import { varsDir } from '@libs/infra-shared-ts/tofu-command';
import { resolvedVarFiles } from '@libs/infra-shared-ts/tofu-var-files';
import { renameReplacing } from '@pkgs/fs-server-ts/rename-replacing';

export function writeResolvedVarFiles(paths: TofuPaths): void {
  for (const [file, text] of resolvedVarFiles()) {
    const path = join(varsDir(paths), file);
    mkdirSync(dirname(path), { recursive: true });
    const partial = `${path}.${String(process.pid)}.partial`;
    writeFileSync(partial, text);
    renameReplacing(partial, path);
  }
}
