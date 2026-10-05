/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import { useLogger } from '@pkgs/logger-client/solid';
import { DismissibleBanner } from '@pkgs/ui-root-client/dismissible-top-banner';
import { createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js';

import type { PwaUpdatePrompt } from './register-service-worker';
import { registerServiceWorker } from './register-service-worker';

/** Top banner when a new Workbox-generated service worker is waiting. */
export function PwaUpdatePromptBanner(): JSX.Element {
  const { t } = useLingui();
  const log = useLogger('pwa');
  const [prompt, setPrompt] = createSignal<PwaUpdatePrompt | null>(null);

  onMount(() => {
    const unregister = registerServiceWorker({
      onUpdateAvailable: (next) => setPrompt(() => next),
      onRegisterError: (error) =>
        log.warn('service worker registration failed', {
          error: error instanceof Error ? error.message : String(error),
        }),
    });
    onCleanup(unregister);
  });

  return (
    <Show when={prompt()}>
      {(current) => (
        <DismissibleBanner
          visible
          position="top"
          onDismiss={() => setPrompt(null)}
          title={<Trans>New version available — reload to update</Trans>}
          actionLabel={t`Reload`}
          onActionClick={() => current().reload()}
          dataSet={{ testid: 'pwa-update-banner' }}
        />
      )}
    </Show>
  );
}
