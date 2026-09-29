/**
 * The same objective file measured against a product with an error burst in
 * the last eight hours — run through a generated stub in a child `bun test`,
 * which must fail.
 */

import { bindObjectives } from '@pkgs/openslo/registry';
import { deliveryMeasures, NOW_MS } from '../openslo/delivery-product';

bindObjectives({
  spec: 'note-delivery',
  measure: deliveryMeasures({
    burst: { fromMs: NOW_MS - 8 * 3_600_000, toMs: NOW_MS },
  }),
  nowMs: () => NOW_MS,
});
