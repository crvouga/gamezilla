import { buildAndSubmitClientNative, requireEasProfile } from '../eas-mobile';
import type { CiPlatform } from '../../platform/platform';
import { runStep } from '../../platform/platform';

/**
 * Manual native-build phase: produces native binaries (iOS + Android) and,
 * for `production`, submits them to the stores. Driven by the manually
 * dispatched `build-client-native` command / `eas-build-release.yml`
 * workflow — never by the routine `infra deploy`.
 *
 * Requires an explicit profile ({@link requireEasProfile} hard-fails when
 * unset) so a release can never fire from a workstation by accident.
 */
export async function runBuildClientEasNativePhase(
  platform: CiPlatform
): Promise<void> {
  const profile = requireEasProfile();
  await runStep(platform, `Build client native (EAS, ${profile})`, () =>
    buildAndSubmitClientNative(platform, profile)
  );
}
