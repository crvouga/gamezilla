/** @jsxImportSource @solidjs/web */
/** `/more/troubleshooting` — the diagnostics behind Settings → Troubleshooting. */

import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from '@solidjs/web';
import { usePerfHudPreference } from './perf-hud-preference';
import { TroubleshootingScreenView } from './troubleshooting-screen-view';

/** Wires `TroubleshootingScreenView` to navigation and the perf preference. */
export function TroubleshootingScreen(): JSX.Element {
  const router = useRouter();
  const { enabled: perfEnabled } = usePerfHudPreference();
  return (
    <TroubleshootingScreenView
      perfEnabled={perfEnabled()}
      onNavigate={(href) => router.push(href)}
    />
  );
}
