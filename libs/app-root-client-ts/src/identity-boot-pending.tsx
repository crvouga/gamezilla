import { reloadApp } from '@libs/app-root-shared-ts/reload-app';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { createSignal, type JSX, onCleanup, onMount } from 'solid-js';
import { IdentityBootScreenView } from './identity-boot-screen-view';

/** Local identity normally binds immediately; a failed refresh must not hang. */
export const IDENTITY_BOOT_DEADLINE_MS = 10_000;

/** Runs the identity deadline and renders `IdentityBootScreenView`. */
export function IdentityBootPending(): JSX.Element {
  const timers = useTimers();
  const log = useLogger('identity-boot');
  const [stuck, setStuck] = createSignal(false);
  onMount(() => {
    const timer = timers.setTimeout(() => {
      log.error('local identity did not become ready');
      setStuck(true);
    }, IDENTITY_BOOT_DEADLINE_MS);
    onCleanup(() => timers.clearTimeout(timer));
  });
  return (
    <IdentityBootScreenView
      status={stuck() ? 'stuck' : 'pending'}
      onReload={reloadApp}
    />
  );
}
