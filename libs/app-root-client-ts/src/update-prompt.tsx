/** @jsxImportSource @solidjs/web */
import { useLogger } from '@pkgs/logger-client-ts/solid';
import type { JSX } from '@solidjs/web';
import { createEffect, createSignal } from 'solid-js';
import { useOfflinePreference } from './offline-preference';
import { PwaUpdatePromptBannerView } from './pwa-update-prompt-view';
import type { PwaUpdatePrompt } from './register-service-worker';
import {
  registerServiceWorker,
  unregisterServiceWorker,
} from './register-service-worker';

/** Top banner when a new Workbox-generated service worker is waiting. */
export function PwaUpdatePromptBanner(): JSX.Element {
  const log = useLogger('pwa');
  const { offline } = useOfflinePreference();
  const [prompt, setPrompt] = createSignal<PwaUpdatePrompt | null>(null);
  createEffect(
    () => offline(),
    (closed) => {
      setPrompt(null);
      if (closed) {
        void unregisterServiceWorker();
        return;
      }
      return registerServiceWorker({
        networkAllowed: () => !offline(),
        onUpdateAvailable: (next) => setPrompt(() => next),
        onRegisterError: (error) =>
          log.warn('service worker registration failed', {
            error: error instanceof Error ? error.message : String(error),
          }),
      });
    }
  );

  return (
    <PwaUpdatePromptBannerView
      visible={prompt() !== null}
      onDismiss={() => setPrompt(null)}
      onReload={() => prompt()?.reload()}
    />
  );
}
