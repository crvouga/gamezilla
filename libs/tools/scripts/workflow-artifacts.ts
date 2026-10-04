// @io-wall-ok — CLI adapter: native artifact listing, downloads and extraction.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

type Artifact = { readonly artifact_id: string; readonly name: string };

function command(argv: readonly string[]): string {
  const result = spawnSync(argv[0]!, argv.slice(1), { encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`${argv[0]} failed: ${result.stderr}`);
  return result.stdout;
}

/** Each attempt has its own directory, so parallel jobs never overwrite evidence. */
export function downloadRunArtifacts(
  runId: string,
  prefix: string,
  destination: string
): void {
  const config = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../infra-shared/tofu/global.tfvars.json'),
      'utf8'
    )
  ) as { depot: { org_id: string } };
  const org = ['--org', config.depot.org_id];
  const listed = JSON.parse(
    command(['depot', 'ci', 'artifacts', 'list', runId, ...org, '-o', 'json'])
  ) as { artifacts: readonly Artifact[] };
  const artifacts = listed.artifacts.filter((artifact) =>
    artifact.name.startsWith(prefix)
  );
  if (artifacts.length === 0)
    throw new Error(`No ${prefix} artifacts in native run ${runId}`);
  for (const artifact of artifacts) {
    if (!/^[A-Za-z0-9_-]+$/.test(artifact.artifact_id))
      throw new Error('Invalid native artifact ID');
    const directory = join(destination, artifact.artifact_id);
    mkdirSync(directory, { recursive: true });
    const archive = join(directory, 'artifact.zip');
    command([
      'depot',
      'ci',
      'artifacts',
      'download',
      artifact.artifact_id,
      ...org,
      '--output-file',
      archive,
    ]);
    try {
      command(['unzip', '-n', archive, '-d', directory]);
    } finally {
      rmSync(archive);
    }
  }
}

if (import.meta.main) {
  const [runId, prefix, destination] = process.argv.slice(2);
  if (!runId || !prefix || !destination)
    throw new Error(
      'usage: workflow-artifacts.ts <run-id> <name-prefix> <directory>'
    );
  downloadRunArtifacts(runId, prefix, destination);
}
