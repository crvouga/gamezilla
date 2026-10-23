/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { DismissibleBanner } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import {
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show,
} from 'solid-js';
import { useOfflinePreference } from './offline-preference';
import type { PwaUpdatePrompt } from './register-service-worker';
import {
  registerServiceWorker,
  unregisterServiceWorker,
} from './register-service-worker';

/** Top banner when a new Workbox-generated service worker is waiting. */
export function PwaUpdatePromptBanner(): JSX.Element {
  const { t } = useLingui();
  const log = useLogger('pwa');
  const { offline } = useOfflinePreference();
  const [prompt, setPrompt] = createSignal<PwaUpdatePrompt | null>(null);
  let detach = (): void => undefined;
  createEffect(
    on(offline, (closed) => {
      detach();
      detach = (): void => undefined;
      setPrompt(null);
      if (closed) {
        void unregisterServiceWorker();
        return;
      }
      detach = registerServiceWorker({
        networkAllowed: () => !offline(),
        onUpdateAvailable: (next) => setPrompt(() => next),
        onRegisterError: (error) =>
          log.warn('service worker registration failed', {
            error: error instanceof Error ? error.message : String(error),
          }),
      });
    })
  );
  onCleanup(() => detach());

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
