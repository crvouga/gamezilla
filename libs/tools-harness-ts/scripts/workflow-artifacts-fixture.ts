// @io-wall-ok — executable GitHub CLI fixture for the artifact adapter test.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env['CI_ARTIFACT_FIXTURE_ROOT']!;
const args = process.argv.slice(2);
appendFileSync(join(root, 'commands.ndjson'), `${JSON.stringify(args)}\n`);
if (args[0] === 'api' && args.includes('--slurp')) {
  console.log(
    JSON.stringify([
      { artifacts: [{ id: 11, name: 'observability-traces-same-name' }] },
      { artifacts: [{ id: 12, name: 'observability-traces-same-name' }] },
    ])
  );
} else {
  const id = /\/artifacts\/(11|12)\/zip$/.exec(args[1] ?? '')?.[1];
  if (!id) throw new Error('Expected an artifact download by ID');
  process.stdout.write(readFileSync(join(root, `${id}.zip`)));
}
