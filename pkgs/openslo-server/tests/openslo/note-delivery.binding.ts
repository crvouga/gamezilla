/** The fixture objective file, measured against the healthy fixture product. */

import { bindObjectives } from '@pkgs/openslo-shared/registry';
import { deliveryMeasures, NOW_MS } from './delivery-product';

bindObjectives({
  spec: 'note-delivery',
  measure: deliveryMeasures(),
  nowMs: () => NOW_MS,
});
