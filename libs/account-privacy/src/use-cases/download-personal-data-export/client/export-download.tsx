import { useMyId } from '@libs/auth/public/use-current-user';
import { DenialSurface } from '@libs/permissions/public/denial-surface';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useDecision } from '@libs/permissions/public/use-can';
import { Trans } from '@lingui/solid/macro';
import { useClock } from '@pkgs/clock/solid';
import { useSyncEngine } from '@pkgs/sync-engine/solid';
import { createEffect, type JSX, onCleanup, Show } from 'solid-js';
import type { AccountPrivacyRow } from '../../hydrate-account-privacy/client/use-account-privacy';

export function ExportDownload(props: { readonly row: AccountPrivacyRow | null }): JSX.Element {
  const myId = useMyId();
  const engine = useSyncEngine();
  const clock = useClock();
  const decision = useDecision(PERMISSION.profileExportData);
  const fresh = () => props.row?.ready_at != null && clock.now() - Date.parse(props.row.ready_at) < 7 * 86_400_000;
  createEffect(() => {
    if (!decision().allowed || props.row?.export_status !== 'Ready' || !fresh()) return;
    const subscription = engine.subscribeQuery('downloadPersonalDataExport', { accountId: myId() });
    onCleanup(() => subscription.unsubscribe());
  });
  return <Show when={props.row?.export_status === 'Ready'}>
    <Show when={fresh()} fallback={<p class="text" data-testid="privacy-export-expired"><Trans>The export has expired. Ask for a new one.</Trans></p>}>
      <Show when={decision().allowed} fallback={<DenialSurface decision={decision()} testId="privacy-download-denial" />}>
        <Show when={props.row?.export_detail && props.row?.export_summary}>
          <div class="box gap-3" data-testid="privacy-export-ready">
            <p class="text"><Trans>Your export is ready. Downloads are private to your recently proven account and expire 7 days after becoming ready.</Trans></p>
            <a class="text" data-testid="privacy-export-summary" download="personal-data-summary.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(props.row?.export_summary ?? '')}`}><Trans>Download readable summary</Trans></a>
            <a class="text" data-testid="privacy-export-detail" download="personal-data.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(props.row?.export_detail ?? '')}`}><Trans>Download reusable detail</Trans></a>
          </div>
        </Show>
      </Show>
    </Show>
  </Show>;
}
