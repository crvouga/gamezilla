import { BunDep } from '../deps/bun';
import { EasDep } from '../deps/eas';
import type { Dep } from '../deps/types';
import { cliIo } from '../lib/cli-io';
import { banner } from '../lib/fmt';
import { runBuildClientEasNativePhase } from '../lib/phases/build-client-eas-native';
import { runCheckDepsPhase } from '../lib/phases/check-deps';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

const EAS_BUILD_DEPS: readonly Dep[] = [new EasDep(), new BunDep()];

/**
 * Manual native build + store submission. Runs `eas build --platform all`
 * (and `--auto-submit` for `production`), waiting for the cloud builds so a
 * release surfaces failures. Triggered by the manually-dispatched
 * `eas-build-release.yml` workflow, or locally:
 *
 *   EAS_PROFILE=production bun run infra build-client-native
 *
 * Takes no global lock — it mutates no gamezilla infra, only EAS cloud
 * builds. `EAS_PROFILE` is required (hard error when unset) so a release can
 * never fire by accident. Routine `infra deploy` does NOT run this; it only
 * publishes OTA updates.
 */
export class BuildClientNativeCommand implements Command {
  readonly id = 'build-client-native';
  readonly group = 'lifecycle' as const;
  readonly summary = 'Build native binaries + submit to stores (manual)';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = cliIo.clock.now();
    banner('Build client native (EAS)');
    await runCheckDepsPhase(this.platform, EAS_BUILD_DEPS);
    await runBuildClientEasNativePhase(this.platform);
    banner('Build client native (EAS) complete', cliIo.clock.now() - t0);
  }
}
