import type { Command } from '../command';
import type { CiPlatform } from '../platform';
import { ALL_DEPS } from '../dep';
import { banner, ok, fail, warn, info } from '../fmt';

export class InstallDepsCommand implements Command {
  readonly id = 'install-deps';
  readonly summary = 'Install or upgrade missing / outdated CLI dependencies';

  constructor(private readonly platform: CiPlatform) {}

  execute(): void {
    banner('Install / Upgrade Dependencies');

    let installed = 0;
    let skipped = 0;
    let failed = 0;

    for (const dep of ALL_DEPS) {
      const status = dep.check();

      if (status.ok) {
        ok(dep.name, `already installed (${status.version})`);
        skipped++;
        continue;
      }

      warn(dep.name, status.reason);
      info(dep.name, 'installing…');

      try {
        dep.install();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        fail(dep.name, `install failed — ${msg}`);
        failed++;
        continue;
      }

      const after = dep.check();
      if (after.ok) {
        ok(dep.name, `installed (${after.version})`);
        installed++;
      } else {
        fail(dep.name, `still not available after install — ${after.reason}`);
        failed++;
      }
    }

    banner('Summary');
    info('installed', String(installed));
    info('already ok', String(skipped));
    if (failed > 0) {
      fail('failed', String(failed));
      throw new Error(`${failed} dep(s) could not be installed`);
    }
  }
}
