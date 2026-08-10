import { cliIo } from '../lib/cli-io';
import { banner } from '../lib/fmt';
import { runMigratePhase } from '../lib/phases/migrate';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

/**
 * CI atomic step 2: runs `bun run db:migrate` against the production
 * Postgres. Lock is held externally by `lock-acquire` so this step is
 * serialized against any other deploy run.
 */
export class MigrateCommand implements Command {
  readonly id = 'migrate';
  readonly group = 'phase' as const;
  readonly summary = 'Run Postgres migrations against production DB';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = cliIo.clock.now();
    banner('Migrate');
    await runMigratePhase(this.platform);
    banner('Migrate Complete', cliIo.clock.now() - t0);
  }
}
