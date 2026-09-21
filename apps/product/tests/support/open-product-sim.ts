import {
  type OpenSim,
  type OpenSimOptions,
  openSim as openHarnessSim,
} from '@libs/sim-harness/open-sim/open-sim';

import { product } from '../../src/sim/system';

/** Open a reported sim of the full composition (every feature). */
export function openSim(
  testId: string,
  options?: OpenSimOptions
): Promise<OpenSim> {
  return openHarnessSim(product, testId, options);
}

export type { OpenSim, OpenSimOptions };
