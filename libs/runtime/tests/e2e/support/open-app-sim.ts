import { APP_SYSTEM } from '@libs/runtime/sim/app-composition';
import {
  type OpenSim,
  type OpenSimOptions,
  openSim as openHarnessSim,
} from '@libs/sim-harness/open-sim/open-sim';

/**
 * Open a reported sim of the full composition: every feature, folded exactly
 * as production folds them, migrated by the production runner. Only the
 * whole-app suite runs this — it reruns for every feature change, by design.
 */
export function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(APP_SYSTEM, testId, options);
}

export type { OpenSim, OpenSimOptions };
