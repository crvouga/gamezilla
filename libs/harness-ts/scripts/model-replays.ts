// @io-wall-ok — draws a package's models and writes its Quint replay plan.
/**
 * Writes a package's replay plan (`replay-plans.ts`) from the draw on the
 * pinned seed. Run it in the package directory after a model or binding
 * change:
 *
 *   bun run --conditions=browser --conditions=development \
 *     --preload=@pkgs/bun-test-solid-client-ts/register \
 *     ../../libs/harness-ts/scripts/model-replays.ts --write
 */

import { existsSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import {
  drawModelInstances,
  instancesReplayPlan,
} from '@pkgs/quint-server-ts/model-instances';
import type { ReplayPlan } from '@pkgs/quint-server-ts/trace-runs';
import { quintBinding } from '@pkgs/quint-shared-ts/registry';
import type { ReplayPlans } from './replay-plans';
import { REPLAY_PLAN_PATH } from './replay-plans';
import { packageSpecs } from './spec-sources';

/** The plan file's text: models in path order, as the draw has them now. */
export function formatReplayPlans(plans: ReplayPlans): string {
  const sorted = Object.fromEntries(
    Object.keys(plans)
      .sort()
      .map((model) => [model, plans[model]])
  );
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

async function writePlans(dir: string): Promise<void> {
  const root = resolve(import.meta.dirname, '../../..');
  const entry = join(dir, 'tests/quint/index.ts');
  if (!existsSync(entry)) throw new Error(`${dir}: no tests/quint/index.ts`);
  // The entry registers the bindings and the host's variants; it opens no world.
  await import(entry);
  const plans: Record<string, ReplayPlan> = {};
  for (const specPath of packageSpecs(dir, root)) {
    if (!specPath.endsWith('.qnt')) continue;
    const model = basename(specPath, '.qnt');
    const specUri = slashPath(relative(root, specPath));
    const binding = quintBinding(model);
    const instances = drawModelInstances({
      specPath,
      specUri,
      model,
      binding,
      outDir: join(dir, '.cache/replay-plan', model),
    });
    plans[model] = instancesReplayPlan(instances, binding);
    console.log(`quint: planned ${model}`);
  }
  writeFileSync(join(dir, REPLAY_PLAN_PATH), formatReplayPlans(plans));
}

if (import.meta.main) {
  if (process.argv[2] !== '--write') {
    console.error('model-replays: pass --write in a package directory');
    process.exit(1);
  }
  await writePlans(process.cwd());
  // Binding imports may own harness handles; the plan is written.
  process.exit(0);
}
