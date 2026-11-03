/** @jsxImportSource solid-js */
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { createEffect, createSignal, type JSX, on, onCleanup } from 'solid-js';
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
    <PwaUpdatePromptBannerView
      visible={prompt() !== null}
      onDismiss={() => setPrompt(null)}
      onReload={() => prompt()?.reload()}
    />
  );
}
