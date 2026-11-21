// @io-wall-ok — CLI entry: reads the repository, writes the artifact folder, runs Claude Code
/**
 * `bun run design:sync`: republishes the Gamezilla design-system artifact
 * from the committed code. Builds the artifact's `project/` files into
 * `.cache/design-sync/project/` (see `design-artifact.ts`), then has Claude
 * Code publish them to the artifact, which only Claude's Artifact tool can
 * write. `--build-only` stops after the folder is written.
 *
 * Refuses to run while `design-system/` has uncommitted changes: the artifact
 * shows what is committed, never a working copy.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderArtifact } from './design-artifact';

export const ARTIFACT_URL = 'https://claude.ai/artifact/WhfG2jxcpi2strAy8Z6dB7';

const REPO = path.join(import.meta.dir, '..');
const OUT = path.join(REPO, '.cache', 'design-sync');
const UI = path.join(REPO, 'pkgs', 'ui-root-client-ts');
const buildOnly = process.argv.includes('--build-only');

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { cwd: REPO, encoding: 'utf8' });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

const dirty = process.env.DESIGN_SYNC_ALLOW_DIRTY
  ? ''
  : run('git', ['status', '--porcelain', '--', 'design-system']);
if (dirty) {
  console.error(
    `design-system/ has uncommitted changes; commit them first:\n${dirty}`
  );
  process.exit(1);
}

run('bun', ['run', 'pkgs/ui-root-client-ts/scripts/generate-tokens-css.ts']);

const read = (file: string) => Bun.file(path.join(REPO, file)).text();

async function componentSources() {
  const src = path.join(UI, 'src');
  const sources = [];
  for (const slice of readdirSync(src, { withFileTypes: true })) {
    if (!slice.isDirectory()) continue;
    const dir = path.join(src, slice.name);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.stories.tsx')) continue;
      const index = path.join(dir, 'index.tsx');
      const hasModule = await Bun.file(index).exists();
      sources.push({
        storyPath: path.relative(REPO, path.join(dir, file)),
        story: await Bun.file(path.join(dir, file)).text(),
        module: hasModule ? await Bun.file(index).text() : undefined,
        modulePath: hasModule ? path.relative(REPO, index) : undefined,
      });
    }
  }
  return sources.sort((a, b) => a.storyPath.localeCompare(b.storyPath));
}

const files = renderArtifact({
  tokenSource: await read('design-system/tokens.json'),
  tokensCss: await read('pkgs/ui-root-client-ts/src/tokens.css'),
  resolvedTokens: await read('pkgs/ui-root-client-ts/src/tokens.json'),
  readme: await read('design-system/README.md'),
  spaces: await read('design-system/spaces.md'),
  components: await componentSources(),
  repo: run('gh', [
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '-q',
    '.nameWithOwner',
  ]),
  commit: run('git', ['rev-parse', '--short', 'HEAD']),
  date: new Date().toISOString(),
});

rmSync(OUT, { recursive: true, force: true });
for (const file of files) {
  const target = path.join(OUT, 'project', file.path);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, file.text);
}
writeFileSync(
  path.join(OUT, 'files.json'),
  `${JSON.stringify(
    files.map((file) => `project/${file.path}`),
    null,
    2
  )}\n`
);
console.log(
  `wrote ${files.length} artifact files to ${path.relative(REPO, OUT)}/project`
);
if (buildOnly) process.exit(0);

const prompt = (await read('scripts/DESIGN_SYNC.prompt.md'))
  .replaceAll('{{ARTIFACT_URL}}', ARTIFACT_URL)
  .replaceAll('{{FOLDER}}', OUT);
const publish = spawnSync(
  'claude',
  [
    '-p',
    prompt,
    '--allowedTools',
    'Artifact,Read,Write,Bash(cat:*),Bash(ls:*)',
  ],
  { cwd: REPO, stdio: 'inherit' }
);
process.exit(publish.status ?? 1);
