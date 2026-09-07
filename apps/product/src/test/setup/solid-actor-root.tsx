/** @jsxImportSource solid-js */
/**
 * Solid root for one sim actor: the product `App` in embedded mode (memory
 * router, no document shortcuts) so many actors share one happy-dom document.
 *
 * The `MemoryHistory` is created once per actor and owned here, outside the
 * component: the multi-actor session unmounts a parked actor's tree and
 * remounts it on focus, and the route must survive that round trip.
 */

import type { Client } from '@apps/client/shell/create-client';
import { createMemoryHistory } from '@solidjs/router';
import type { JSX } from 'solid-js';

export function solidActorRoot(live: Client): () => JSX.Element {
  const history = createMemoryHistory();
  return () => <live.App embedded history={history} />;
}
