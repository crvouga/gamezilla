import { bunWebviewRuntime } from '@libs/sim-harness/hosts/bun-webview';
import { defineProductSystem } from '@libs/sim-harness/system/define-product-system';
import { defineRuntime } from '@pkgs/sim';

import { APP_COMPOSITION } from './composition';

/**
 * The product system over the full composition. Hosts: `in-process`
 * (default) and `bun-webview` (live browser; `SIM_MODE=real|stack`).
 */
export const product = defineProductSystem(APP_COMPOSITION, {
  runtimes: [
    defineRuntime({
      name: 'bun-webview',
      create: () =>
        bunWebviewRuntime({
          composition: APP_COMPOSITION,
          ensureRealStack: async () => {
            const { ensureMaxFidelityStack } = await import(
              './setup/real-mode-stack'
            );
            await ensureMaxFidelityStack();
          },
        }),
    }),
  ],
});
