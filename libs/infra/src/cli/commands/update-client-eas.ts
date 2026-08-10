import { BunDep } from '../deps/bun';
import { EasDep } from '../deps/eas';
import type { Dep } from '../deps/types';
import { cliIo } from '../lib/cli-io';
import { banner } from '../lib/fmt';
import { runCheckDepsPhase } from '../lib/phases/check-deps';
import { runPublishClientEasUpdatePhase } from '../lib/phases/publish-client-eas-update';
import { readInfraContextFromEnv } from '../lib/serialize-infra-context';
import type { CiPlatform } from '../platform/platform';
import type { Command } from './types';

const EAS_UPDATE_DEPS: readonly Dep[] = [new EasDep(), new BunDep()];

/**
 * Standalone OTA mobile update: publishes an `eas update` for the client.
 * Mainly for local dev — set `EAS_PROFILE=development` to ship the
 * development channel without a full `infra deploy`:
 *
 *   EAS_PROFILE=development bun run infra update-client-eas
 *
 * The full `infra deploy` runs this same phase automatically (after smoke +
 * refresh-config) when an EAS profile resolves. Native binaries are built
 * separately by `infra build-client-native`.
 */
export class UpdateClientEasCommand implements Command {
  readonly id = 'update-client-eas';
  readonly group = 'phase' as const;
  readonly summary = 'Publish OTA eas update for mobile client';

  constructor(private readonly platform: CiPlatform) {}

  async execute(): Promise<void> {
    const t0 = cliIo.clock.now();
    banner('Publish client OTA update (EAS)');
    await runCheckDepsPhase(this.platform, EAS_UPDATE_DEPS);
    const ctx = readInfraContextFromEnv();
    await runPublishClientEasUpdatePhase(this.platform, ctx);
    banner('Publish client OTA update (EAS) complete', cliIo.clock.now() - t0);
  }
}
