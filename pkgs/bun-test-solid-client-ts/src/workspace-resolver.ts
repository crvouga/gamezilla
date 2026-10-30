import { dirname } from 'node:path';

export const WORKSPACE_IMPORT = /^@(libs|pkgs)\//;

/** Keep Bun's public export rules when isolated realms load plugin-transformed TSX. */
export function createWorkspaceResolver(
  resolve: (specifier: string, directory: string) => string
): (args: { path: string; importer: string }) => { path: string } | undefined {
  let resolving = false;
  return (args) => {
    if (!WORKSPACE_IMPORT.test(args.path) || resolving) return;
    resolving = true;
    try {
      // Bun.resolveSync re-enters runtime onResolve hooks synchronously. Let
      // that inner call use Bun's native resolver rather than recurse forever.
      return { path: resolve(args.path, dirname(args.importer)) };
    } finally {
      resolving = false;
    }
  };
}
