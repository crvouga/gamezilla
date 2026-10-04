// @io-wall-ok — the spec gate reads every aggregate model.
/**
 * Static shape of every Quint aggregate under `specs/`. A context's
 * `events.qnt` is its published language, not an aggregate.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatModelShapeIssue } from '@pkgs/quint-shared/shape-model';
import { modelShapeIssues } from '@pkgs/quint-shared/shape';
import { maintenanceVocabulary } from './spec-glossary';
import { REPO_ROOT, SPECS_DIR } from './spec-packages';

/** One printable line per shape problem, repo-relative. */
export function modelShapeProblems(
  campaignDomains: ReadonlySet<string>
): readonly string[] {
  const files = [
    ...new Bun.Glob('**/*.qnt').scanSync({ cwd: join(REPO_ROOT, SPECS_DIR) }),
  ].sort();
  const problems: string[] = [];
  const maintenanceContexts = maintenanceVocabulary();
  for (const file of files) {
    if (file === 'events.qnt' || file.endsWith('/events.qnt')) continue;
    // Campaign roots and imported helpers retain their own safety/temporal checks.
    if (campaignDomains.has(file.split('/')[0] ?? '')) continue;
    const specUri = `${SPECS_DIR}/${file}`;
    const text = readFileSync(join(REPO_ROOT, specUri), 'utf8');
    const maintenance = /^\/\/ @model-profile: maintenance\s*$/m.test(text);
    if (maintenance !== maintenanceContexts.has(file.split('/')[0]!)) {
      problems.push(
        `${specUri}: model profile must match its bounded context's glossary profile`
      );
    }
    for (const found of modelShapeIssues(text, specUri)) {
      problems.push(formatModelShapeIssue(specUri, found));
    }
  }
  return problems;
}
