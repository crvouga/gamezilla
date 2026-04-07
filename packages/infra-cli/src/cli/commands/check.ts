import { ALL_DEPS } from '../deps/deps';
import { banner, fail, ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

export class CheckCommand implements Command {
  readonly id = 'check';
  readonly summary =
    'Verify that all CLI dependencies are installed and reachable';

  constructor(private readonly platform: CiPlatform) {}

  execute(): void {
    banner('Prerequisite Check');

    const failures: string[] = [];

    for (const dep of ALL_DEPS) {
      const status = dep.check();
      if (!status.ok) {
        fail(dep.name, status.reason);
        failures.push(dep.name);
        continue;
      }
      ok(dep.name, status.version);

      if (dep.verify) {
        try {
          dep.verify();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          fail(`${dep.name} verify`, msg);
          failures.push(dep.name);
          continue;
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Missing deps: ${failures.join(', ')}. Run "bun run infra install-deps" to install them.`
      );
    }
  }
}
