import { type CliDep, captureVersionDiagnostic, verifyRun } from '@pkgs/os';

/** Log `id: version` after a successful verify probe. */
export function logCliVersion(
  id: string,
  bin: string,
  versionArgs: readonly string[] = ['--version']
): void {
  verifyRun(bin, versionArgs);
  const version = captureVersionDiagnostic(bin, versionArgs).version;
  console.log(`${id}: ${version ?? 'installed'}`);
}

/** Wrap a sync install body as a {@link CliDep}. */
export function defineCliDep(opts: {
  readonly id: string;
  readonly dependsOn?: readonly string[];
  readonly installOrUpgrade: () => void | Promise<void>;
}): CliDep {
  return {
    id: opts.id,
    dependsOn: opts.dependsOn ?? [],
    async installOrUpgrade() {
      await opts.installOrUpgrade();
    },
  };
}
