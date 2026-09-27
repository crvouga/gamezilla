// @io-wall-ok — resolves the broker binary for the process runner
import { existsSync } from 'node:fs';
import { capture } from '@pkgs/os/command';

/**
 * The `emqx` binary: `EMQX_BIN` when set, else the release pinned in the repo's
 * `mise.toml` (`mise install` puts it there; `mise which` finds it whether or
 * not the shell activates mise).
 */
export function resolveEmqxBin(): string {
  const fromEnv = process.env['EMQX_BIN']?.trim();
  if (fromEnv) {
    if (!existsSync(fromEnv)) {
      throw new Error(`EMQX_BIN not found: ${fromEnv}`);
    }
    return fromEnv;
  }
  const r = capture('mise', ['which', 'emqx']);
  const path = r.stdout.trim();
  if (r.status === 0 && path.length > 0) return path;
  throw new Error(
    `emqx not installed — run \`mise install\` (${r.stderr.trim() || 'mise which emqx failed'})`
  );
}
