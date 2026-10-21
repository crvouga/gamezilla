import { useMyId } from '@libs/auth-client/use-current-user';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { decidePrivacyExportOwner } from '@libs/permissions-shared/privacy-permission';
import { Trans } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock-client/solid';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { createEffect, createMemo, type JSX, onCleanup, Show } from 'solid-js';
import { exportDownloadable } from './privacy-dates';
import type { AccountPrivacyRow } from './use-account-privacy';

export function ExportDownload(props: {
  readonly row: AccountPrivacyRow | null;
  readonly ownerId: string;
}): JSX.Element {
  const myId = useMyId();
  const engine = useSyncEngine();
  const clock = useClock();
  const access = useDecision(PERMISSION.profileExportData);
  const decision = () =>
    decidePrivacyExportOwner(access(), myId(), props.ownerId);
  const fresh = () => exportDownloadable(props.row?.ready_at, clock.now());
  const downloadAccount = createMemo(() =>
    decision().allowed && props.row?.export_status === 'Ready' && fresh()
      ? props.ownerId
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
  return (
    <Show
      when={decision().reason !== 'restricted'}
      fallback={
        <p class="text textBody" data-testid="privacy-export-owner-denial">
          <Trans>
            This export belongs to another account and cannot be downloaded.
          </Trans>
        </p>
      }
    >
      <Show
        when={
          props.row?.export_status === 'Ready' ||
          props.row?.export_status === 'Expired'
        }
      >
        <Show
          when={fresh()}
          fallback={
            <p class="text textBody" data-testid="privacy-export-expired">
              <Trans>The export has expired. Ask for a new one.</Trans>
            </p>
          }
        >
          <Show
            when={decision().allowed}
            fallback={
              <DenialSurface
                decision={decision()}
                testId="privacy-download-denial"
              />
            }
          >
            <Show when={props.row?.export_detail && props.row?.export_summary}>
              <div class="box gap-3" data-testid="privacy-export-ready">
                <p class="text textBody">
                  <Trans>
                    Your export is ready. Downloads are private to your recently
                    proven account and expire 7 days after becoming ready.
                  </Trans>
                </p>
                <a
                  class="text textBody"
                  data-testid="privacy-export-summary"
                  download="personal-data-summary.txt"
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(props.row?.export_summary ?? '')}`}
                >
                  <Trans>Download readable summary</Trans>
                </a>
                <a
                  class="text textBody"
                  data-testid="privacy-export-detail"
                  download="personal-data.json"
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(props.row?.export_detail ?? '')}`}
                >
                  <Trans>Download reusable detail</Trans>
                </a>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
