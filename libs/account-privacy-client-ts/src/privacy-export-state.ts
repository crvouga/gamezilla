import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import {
  EXPORT_DOWNLOADABLE_MS,
  exportReadyByMs,
  timestampMs,
} from './privacy-dates';
import type { AccountPrivacyRow } from './use-account-privacy';

/** Where the person's export stands; changes on its own as time passes. */
export type ExportPhase = 'none' | 'preparing' | 'overdue' | 'readyToReplace';

/** What the export's download area shows, resolved by the container. */
export type ExportDownloadState =
  /** Nothing to download: no export, or one still being prepared. */
  | { readonly kind: 'none' }
  /** The export route names another account's export. */
  | { readonly kind: 'ownerDenied' }
  /** The ready export is past its download window. */
  | { readonly kind: 'expired' }
  /** Downloading is denied, e.g. it needs a recent proof of the account. */
  | { readonly kind: 'denied'; readonly denial: DenialView }
  | {
      readonly kind: 'ready';
      readonly summary: string;
      readonly detail: string;
    };

/** The export's phase at `nowMs`. */
export function exportPhaseAt(
  row: AccountPrivacyRow | null,
  nowMs: number
): ExportPhase {
  const readyBy = exportReadyByMs(row?.requested_at);
  if (row?.export_status === 'Preparing')
    return readyBy !== null && nowMs >= readyBy ? 'overdue' : 'preparing';
  const readyAt = timestampMs(row?.ready_at);
  if (
    row?.export_status === 'Ready' &&
    readyAt !== null &&
    nowMs - readyAt < EXPORT_DOWNLOADABLE_MS
  )
    return 'readyToReplace';
  return 'none';
}

/** When `phase` next changes with only time passing, or `null`. */
export function exportPhaseChangesAtMs(
  row: AccountPrivacyRow | null,
  phase: ExportPhase
): number | null {
  if (phase === 'preparing') return exportReadyByMs(row?.requested_at);
  const readyAt = timestampMs(row?.ready_at);
  return phase === 'readyToReplace' && readyAt !== null
    ? readyAt + EXPORT_DOWNLOADABLE_MS
    : null;
}
