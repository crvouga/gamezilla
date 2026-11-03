import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { decidePrivacyExportOwner } from '@libs/permissions-shared-ts/privacy-permission';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createEffect, createMemo, onCleanup } from 'solid-js';
import { exportDownloadable } from './privacy-dates';
import type { ExportDownloadState } from './privacy-export-state';
import type { AccountPrivacyRow } from './use-account-privacy';

/**
 * What the download area shows for `ownerId`'s export, and — while it may be
 * downloaded — the subscription that brings its files to this device.
 */
export function useExportDownload(
  row: Accessor<AccountPrivacyRow | null>,
  ownerId: Accessor<string>
): Accessor<ExportDownloadState> {
  const myId = useMyId();
  const engine = useSyncEngine();
  const clock = useClock();
  const access = useDecision(PERMISSION.profileExportData);
  const decision = () => decidePrivacyExportOwner(access(), myId(), ownerId());
  const denial = useDenialView({
    get decision() {
      return decision();
    },
    testId: 'privacy-download-denial',
  });
  const fresh = () => exportDownloadable(row()?.ready_at, clock.now());
  const downloadAccount = createMemo(() =>
    decision().allowed && row()?.export_status === 'Ready' && fresh()
      ? ownerId()
      : null
  );
  createEffect(() => {
    const accountId = downloadAccount();
    if (accountId === null) return;
    const subscription = engine.subscribeQuery('downloadPersonalDataExport', {
      accountId,
    });
    onCleanup(() => subscription.unsubscribe());
  });
  return createMemo((): ExportDownloadState => {
    if (decision().reason === 'restricted') return { kind: 'ownerDenied' };
    const current = row();
    const status = current?.export_status;
    if (status !== 'Ready' && status !== 'Expired') return { kind: 'none' };
    if (!fresh()) return { kind: 'expired' };
    if (!decision().allowed) return { kind: 'denied', denial: denial() };
    const summary = current?.export_summary;
    const detail = current?.export_detail;
    return summary && detail
      ? { kind: 'ready', summary, detail }
      : { kind: 'none' };
  });
}
