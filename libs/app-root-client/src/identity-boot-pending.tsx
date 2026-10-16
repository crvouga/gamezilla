import { reloadApp } from '@libs/app-root-shared/reload-app';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client/solid';
import { useLogger } from '@pkgs/logger-client/solid';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js';
import { BootLoadingShell } from './boot-loading-shell';

/** Local identity normally binds immediately; a failed refresh must not hang. */
export const IDENTITY_BOOT_DEADLINE_MS = 10_000;

export function IdentityBootPending(): JSX.Element {
  const timers = useTimers();
  const log = useLogger('identity-boot');
  const { t } = useLingui();
  const [stuck, setStuck] = createSignal(false);
  onMount(() => {
    const timer = timers.setTimeout(() => {
      log.error('local identity did not become ready');
      setStuck(true);
    }, IDENTITY_BOOT_DEADLINE_MS);
    onCleanup(() => timers.clearTimeout(timer));
  });
  return (
    <Show when={stuck()} fallback={<BootLoadingShell />}>
      <ErrorState
        title={<Trans>App failed to start</Trans>}
        body={
          <Trans>
            Your account could not be loaded. Check your connection and reload
            the app.
          </Trans>
        }
        retry={{ label: t`Reload app`, onClick: reloadApp }}
      />
    </Show>
  );
}
