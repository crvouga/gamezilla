#!/usr/bin/env bun
// @io-wall-ok — CLI: reads the objective files and writes the generated alert artifacts.
/**
 * Rewrites the alert artifacts derived from the objective files and the
 * indicator catalog:
 *
 *   libs/infra-shared-ts/tofu/modules/observability-views/alert-rules.generated.json
 *   libs/infra-shared-ts/tofu/modules/observability-views/grafana-slos.generated.json
 *   libs/observability-shared-ts/slo-alert-policies.openslo.yaml
 *
 * Run it after changing an objective file, the catalog or a pipeline alert:
 *
 *   bun run libs/observability-shared-ts/scripts/slo-generate.ts
 *
 * A test fails while any of them differs from what this would write. The
 * output depends only on the files read: same input, same bytes.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { renderAlertDocuments } from '@pkgs/openslo-shared-ts/alert-yaml';
import { parseObjectiveFiles } from '../src/objective-files';
import { generateAlertRules, renderAlertRules } from '../src/slo-alert-rules';
import { sloAlertBundle } from '../src/slo-alerts';
import { generateGrafanaSlos, renderGrafanaSlos } from '../src/slo-grafana';

const REPO_ROOT = resolve(import.meta.dir, '../../..');
export const RULES_FILE =
  'libs/infra-shared-ts/tofu/modules/observability-views/alert-rules.generated.json';
export const GRAFANA_SLOS_FILE =
  'libs/infra-shared-ts/tofu/modules/observability-views/grafana-slos.generated.json';
export const POLICIES_FILE =
  'libs/observability-shared-ts/slo-alert-policies.openslo.yaml';

function objectiveTexts(): { path: string; text: string }[] {
  const specs = join(REPO_ROOT, 'specs');
  const out: { path: string; text: string }[] = [];
  for (const context of readdirSync(specs, { withFileTypes: true })) {
    if (!context.isDirectory()) continue;
    for (const file of readdirSync(join(specs, context.name))) {
      if (!file.endsWith('.openslo.yaml')) continue;
      const full = join(specs, context.name, file);
      out.push({
        path: relative(REPO_ROOT, full),
        text: readFileSync(full, 'utf8'),
      });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

if (import.meta.main) {
  const docs = parseObjectiveFiles(objectiveTexts()).map((file) => file.doc);
  writeFileSync(
    join(REPO_ROOT, RULES_FILE),
    renderAlertRules(generateAlertRules(docs))
  );
  writeFileSync(
    join(REPO_ROOT, GRAFANA_SLOS_FILE),
    renderGrafanaSlos(generateGrafanaSlos(docs))
  );
  writeFileSync(
    join(REPO_ROOT, POLICIES_FILE),
    renderAlertDocuments(sloAlertBundle(docs))
  );
  console.log(`wrote ${RULES_FILE}, ${GRAFANA_SLOS_FILE} and ${POLICIES_FILE}`);
}
