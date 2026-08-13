/**
 * Product topology for `@apps/client` UI simulations.
 */

import { defineTopology } from '@pkgs/simulation';

export const clientSimTopology = defineTopology({
  kinds: {
    client: { attributes: ['html', 'sqlite', 'ingress', 'egress'] },
    server: { attributes: ['sqlite', 'ingress', 'egress'] },
    broker: { attributes: ['ingress', 'egress'] },
  },
  nodes: [
    { id: 'server', kind: 'server' },
    { id: 'pubsub', kind: 'broker' },
  ],
  edges: [{ from: 'server', to: 'pubsub', kind: 'pubsub' }],
  spawn: {
    client: {
      edges: [
        { to: 'server', kind: 'http' },
        { to: 'pubsub', kind: 'pubsub' },
      ],
    },
  },
});
