import { useMyId } from '@libs/auth-client-ts/use-current-user';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { decidePrivacyExportOwner } from '@libs/permissions-shared-ts/privacy-permission';
import { Trans } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
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
        <Notice
          tone="warning"
          dataSet={{ testid: 'privacy-export-owner-denial' }}
        >
          <Trans>
            This export belongs to another account and cannot be downloaded.
          </Trans>
        </Notice>
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
            <P tone="secondary" testId="privacy-export-expired">
              <Trans>The export has expired. Ask for a new one.</Trans>
            </P>
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
              <StackVertical gap="sm" testId="privacy-export-ready">
                <P>
                  <Trans>
                    Your export is ready. Downloads are private to your recently
                    proven account and expire 7 days after becoming ready.
                  </Trans>
                </P>
                <TextLink
                  variant="standalone"
                  testId="privacy-export-summary"
                  download="personal-data-summary.txt"
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(props.row?.export_summary ?? '')}`}
                >
                  <Trans>Download readable summary</Trans>
                </TextLink>
                <TextLink
                  variant="standalone"
                  testId="privacy-export-detail"
                  download="personal-data.json"
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(props.row?.export_detail ?? '')}`}
                >
                  <Trans>Download reusable detail</Trans>
                </TextLink>
              </StackVertical>
            </Show>
          </Show>
        </Show>
      </Show>
    </Show>
  );
}
