/**
 * Read objective files for the checks and the generator: parse each text,
 * note whether its first line marks it `# live`, and fail loudly on a file
 * that is not a well-formed objective. The caller reads the files; this only
 * interprets them.
 */

import { isLiveObjectiveSource } from '@pkgs/openslo-shared/live';
import { parseOpenSlo } from '@pkgs/openslo-shared/parse';
import type { ObjectiveFile } from './slo-checks';

export type ObjectiveText = {
  /** Repo-relative path, for messages. */
  readonly path: string;
  readonly text: string;
};

export function parseObjectiveFiles(
  files: readonly ObjectiveText[]
): readonly ObjectiveFile[] {
  return files.map(({ path, text }) => {
    const parsed = parseOpenSlo(text);
    if (!parsed.ok) {
      throw new Error(
        `${path} is not a well-formed objective:\n  ${parsed.issues.join('\n  ')}`
      );
    }
    return { path, live: isLiveObjectiveSource(text), doc: parsed.doc };
  });
}
