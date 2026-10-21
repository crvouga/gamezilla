/**
 * The known-bug register: one `known-bugs/<id>.json` file per bug, so agents
 * pinning different bugs in concurrent worktrees never edit the same file.
 * The file name is the id; the body is the rest of the {@link KnownBug}.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { KnownBug } from './goal-manifest';

export const KNOWN_BUGS_DIR = 'libs/tools-harness-ts/goal/known-bugs';

type KnownBugFile = Partial<Omit<KnownBug, 'id'>>;

/** Every known bug under `root`, in id order. */
export function readKnownBugs(root: string): readonly KnownBug[] {
  const dir = join(root, KNOWN_BUGS_DIR);
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const body = JSON.parse(
        readFileSync(join(dir, name), 'utf8')
      ) as KnownBugFile;
      return {
        id: name.slice(0, -'.json'.length),
        summary: typeof body.summary === 'string' ? body.summary : '',
        regressionTest:
          typeof body.regressionTest === 'string' ? body.regressionTest : '',
      };
    });
}
