import { rmSync } from 'node:fs';

import {
  type QaPlaywrightLane,
  qaPlaywrightPaths,
  resolveGamezillaRepoRoot,
} from '../src/qa-playwright-paths';

const lane = process.argv[2];
if (lane !== 'browser' && lane !== 'native') {
  process.stderr.write(
    'Usage: clear-playwright-blob-lane.ts <browser|native>\n'
  );
  process.exit(1);
}

const repoRoot = resolveGamezillaRepoRoot(import.meta.dir);
const { laneBlobDir } = qaPlaywrightPaths(repoRoot);
const target = laneBlobDir(lane as QaPlaywrightLane);

rmSync(target, { recursive: true, force: true });
process.stdout.write(`[e2e] cleared blob lane ${lane} at ${target}\n`);
