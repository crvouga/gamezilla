// @io-wall-ok — CLI adapter: GitHub artifact listing, downloads and extraction.
import { spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

type Artifact = { readonly id: number; readonly name: string };

function command(argv: readonly string[]): string {
  const result = spawnSync(argv[0]!, argv.slice(1), { encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`${argv[0]} failed: ${result.stderr}`);
  return result.stdout;
}

function downloadArchive(
  repository: string,
  id: number,
  archive: string
): void {
  const output = openSync(archive, 'w');
  try {
    const downloaded = spawnSync(
      'gh',
      ['api', `repos/${repository}/actions/artifacts/${id}/zip`],
      { stdio: ['ignore', output, 'pipe'] }
    );
    if (downloaded.status !== 0)
      throw new Error(`GitHub artifact ${id} download failed`);
  } finally {
    closeSync(output);
  }
}

function downloadArtifact(
  repository: string,
  id: number,
  directory: string
): void {
  const archive = join(directory, 'artifact.zip');
  try {
    downloadArchive(repository, id, archive);
    command(['unzip', '-n', archive, '-d', directory]);
  } finally {
    rmSync(archive, { force: true });
  }
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
  ) as { github: { owner: string; repo: string } };
  const repository = `${config.github.owner}/${config.github.repo}`;
  const pages = JSON.parse(
    command([
      'gh',
      'api',
      '--paginate',
      '--slurp',
      `repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`,
    ])
  ) as { artifacts: readonly Artifact[] }[];
  const listed = { artifacts: pages.flatMap((page) => page.artifacts) };
  const artifacts = listed.artifacts.filter((artifact) =>
    artifact.name.startsWith(prefix)
  );
  if (artifacts.length === 0)
    throw new Error(`No ${prefix} artifacts in GitHub run ${runId}`);
  for (const artifact of artifacts) {
    if (!Number.isSafeInteger(artifact.id) || artifact.id <= 0)
      throw new Error('Invalid GitHub artifact ID');
    const directory = join(destination, String(artifact.id));
    mkdirSync(directory, { recursive: true });
    downloadArtifact(repository, artifact.id, directory);
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
