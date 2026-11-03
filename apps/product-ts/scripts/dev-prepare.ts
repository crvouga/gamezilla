// @io-wall-ok — development process entry.

/**
 * The Turborepo task every `dev:<service>` task depends on: the one step of a
 * boot that has to happen once, before any service starts. It retires what the
 * last boot published, empties the instance and plans the ports (`stack-plan`).
 */

import { existsSync } from 'node:fs';
import { devStackOptions } from './dev-options';
import { resolveDevRepoRoot } from './dev-repo-root';
import { removeManifest } from './manifest';
import { createStackPlan } from './stack-plan';
import { syntheticPopulationStackSecrets } from './synthetic-population-sidecars';

const options = devStackOptions();
const repoRoot = resolveDevRepoRoot(import.meta.dir, existsSync);
removeManifest(repoRoot, options.instanceId);
const plan = await createStackPlan(repoRoot, options);
// Minted once here: the API and the workers each read it, in any order.
syntheticPopulationStackSecrets(plan.dataDir);
process.stdout.write(
  `[stack] instance ${options.instanceId} — api ${plan.apiOrigin}` +
    `${plan.webOrigin === null ? '' : `, web ${plan.webOrigin}`}\n`
);
