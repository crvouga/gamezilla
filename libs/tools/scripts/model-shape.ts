// @io-wall-ok — the spec gate reads every aggregate model.
/**
 * Static shape of every Quint aggregate under `specs/`. A context's
 * `events.qnt` is its published language, not an aggregate.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatModelShapeIssue, modelShapeIssues } from '@pkgs/quint/shape';

import { REPO_ROOT, SPECS_DIR } from './spec-packages';

/** One printable line per shape problem, repo-relative. */
export function modelShapeProblems(
  campaignDomains: ReadonlySet<string>
): readonly string[] {
  const files = [
    ...new Bun.Glob('**/*.qnt').scanSync({ cwd: join(REPO_ROOT, SPECS_DIR) }),
  ].sort();
  const problems: string[] = [];
  for (const file of files) {
    if (file === 'events.qnt' || file.endsWith('/events.qnt')) continue;
    // Campaign roots and imported helpers retain their own safety/temporal checks.
    if (campaignDomains.has(file.split('/')[0] ?? '')) continue;
    const specUri = `${SPECS_DIR}/${file}`;
    const text = readFileSync(join(REPO_ROOT, specUri), 'utf8');
    for (const found of modelShapeIssues(text, specUri)) {
      problems.push(formatModelShapeIssue(specUri, found));
    }
  }
  return problems;
}
