import { banner, info, ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import { runStep } from '../platform/platform';
import { DeployCommand } from './deploy';
import { DestroyCommand } from './destroy';
import { SetupCommand } from './setup';
import { StatusCommand } from './status';
import type { Command } from './types';

export class SlaughterCattleCommand implements Command {
  readonly id = 'slaughter-cattle';
  readonly group = 'validation' as const;
  readonly danger = true;
  readonly summary =
    'Cattle validation flow: setup → status → destroy → status → deploy → status';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = performance.now();
    banner('Slaughter Cattle');
    info('🌾 Farm check', 'Pets🐶 vs Cattle🐄 test started');

    const flow: readonly Command[] = [
      new SetupCommand(this.platform),
      new StatusCommand(this.platform),
      new DestroyCommand(this.platform),
      new StatusCommand(this.platform),
      new DeployCommand(this.platform),
      new StatusCommand(this.platform),
    ];

    for (const command of flow) {
      await runStep(this.platform, `🐄 ${command.id}`, () => command.execute());
    }

    banner('Slaughter Cattle Complete', performance.now() - t0);
    ok('🐄 Cattle mode', 'Infra is confirmed to behave like cattle');
    info('🌾 Farm check', 'complete');
  }
}
