/** @jsxImportSource @solidjs/web */
/**
 * `/more` — settings index: account, preferences, about and troubleshooting
 * groups of `MenuRow`s linking to the sub-screens.
 */

import { APP_VERSION } from '@libs/app-root-shared-ts/app-metadata';
import { useCan } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  bugReportsOf,
  requestBugReport,
} from '@pkgs/feedback-client-ts/request-bug-report';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from '@solidjs/web';
import { type Accessor, createSignal, onCleanup } from 'solid-js';
import { useOfflinePreference } from './offline-preference';
import { SettingsScreenView } from './settings-screen-view';

type Source<T> = { state(): T; subscribe(listener: () => void): () => void };

/** Follows one part of bug reporting; `absent` where it is not running. */
function useBugReporting<T>(
  source: Source<T> | undefined,
  absent: T
): Accessor<T> {
  // Held behind a field: a bare signal reads a function value as a derivation.
  const [value, setValue] = createSignal<{ readonly current: T }>({
    current: source ? source.state() : absent,
  });
  if (source) {
    onCleanup(source.subscribe(() => setValue({ current: source.state() })));
  }
  return () => value().current;
}

/** `/more`: wires `SettingsScreenView` to preferences and permissions. */
export function SettingsScreen(): JSX.Element {
  const router = useRouter();
  const canViewBilling = useCan(PERMISSION.billingView);
  const { muted } = useSoundsPreference();
  const { offline, setOffline } = useOfflinePreference();
  const bugReports = bugReportsOf();
  const bugReport = useBugReporting(bugReports?.controller, null);
  const shake = useBugReporting(bugReports?.shake, 'unavailable');
  return (
    <SettingsScreenView
      muted={muted()}
      offline={offline()}
      canViewBilling={canViewBilling()}
      version={APP_VERSION}
      bugReportsWaiting={bugReport()?.waiting ?? 0}
      shakeToReport={shake()}
      onShakeToReportChange={(on) =>
        void (on ? bugReports?.shake.turnOn() : bugReports?.shake.turnOff())
      }
      onAllowShakeToReport={() => void bugReports?.shake.allow()}
      onReportBug={() => requestBugReport()}
      onOfflineChange={setOffline}
      onNavigate={(href) => router.push(href)}
    />
  );
}
