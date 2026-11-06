/** @jsxImportSource solid-js */
/**
 * `/more` — settings index: account, preferences, about and troubleshooting
 * groups of `MenuRow`s linking to the sub-screens.
 */

import { APP_VERSION } from '@libs/app-root-shared-ts/app-metadata';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useThemePreference } from '@pkgs/ui-root-client-ts/theme-preference';
import { For, type JSX } from 'solid-js';
import { useAppSubs } from './app-subs-context';
import { useOfflinePreference } from './offline-preference';
import { SettingsScreenView } from './settings-screen-view';

/** `/more`: wires `SettingsScreenView` to preferences, permissions and subs. */
export function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const subs = useAppSubs();
  const canViewBilling = useCan(PERMISSION.billingView);
  const { preference } = useThemePreference();
  const { muted } = useSoundsPreference();
  const { offline, setOffline } = useOfflinePreference();
  return (
    <SettingsScreenView
      theme={preference()}
      muted={muted()}
      offline={offline()}
      canViewBilling={canViewBilling()}
      version={APP_VERSION}
      subSettings={<For each={subs.settings}>{(Settings) => <Settings />}</For>}
      onOfflineChange={setOffline}
      onNavigate={(href) => router.push(href)}
    />
  );
}
