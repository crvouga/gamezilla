import { bindDecisions } from '@pkgs/dmn-shared/registry';

import {
  applicationLayer,
  clientLayer,
  SHIPPED,
  serverLayer,
  serverOperation,
} from './access-product';

bindDecisions({
  spec: 'access',
  layers: {
    'application decision': applicationLayer(SHIPPED),
    'server enforcement': serverLayer((facts) =>
      serverOperation(SHIPPED, facts)
    ),
    'client gating': clientLayer(SHIPPED),
  },
});
