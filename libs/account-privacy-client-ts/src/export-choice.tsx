import { requestPersonalDataExportMutation } from '@libs/account-privacy-shared-ts/request-personal-data-export-mutation';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { usePermissions } from '@libs/permissions-client-ts/use-permissions';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';
import {
  EXPORT_DOWNLOADABLE_MS,
  exportReadyByMs,
  formatPrivacyMoment,
  timestampMs,
} from './privacy-dates';
import { privacyDenial } from './privacy-denial';
import type { AccountPrivacyRow } from './use-account-privacy';

type ExportPhase = 'none' | 'preparing' | 'overdue' | 'readyToReplace';

/** Where the person's export stands now; changes on its own as time passes. */
function useExportPhase(row: () => AccountPrivacyRow | null) {
  return createTimedValue<ExportPhase>(
    (nowMs) => {
      const current = row();
      const readyBy = exportReadyByMs(current?.requested_at);
      if (current?.export_status === 'Preparing')
        return readyBy !== null && nowMs >= readyBy ? 'overdue' : 'preparing';
      const readyAt = timestampMs(current?.ready_at);
      if (
        current?.export_status === 'Ready' &&
        readyAt !== null &&
        nowMs - readyAt < EXPORT_DOWNLOADABLE_MS
      )
        return 'readyToReplace';
      return 'none';
    },
    (phase) => {
      const current = row();
      if (phase === 'preparing') return exportReadyByMs(current?.requested_at);
      const readyAt = timestampMs(current?.ready_at);
      return phase === 'readyToReplace' && readyAt !== null
        ? readyAt + EXPORT_DOWNLOADABLE_MS
        : null;
    }
  );
}

function useExportRequest(onDenied: (decision: Decision) => void) {
  const { t } = useLingui();
  const client = useMutationClient();
  const permissions = usePermissions();
  return async () => {
    const decision = permissions.can(PERMISSION.profileExportData);
    if (!decision.allowed) {
      onDenied(decision);
      throw new Error(t`The export was not requested. Use the choice shown.`);
    }
    const result = await client.mutate(requestPersonalDataExportMutation, {});
    if (result.ok) return;
    const refused = privacyDenial(
      result.failures[0],
      PERMISSION.profileExportData
    );
    if (refused !== null) {
      onDenied(refused);
      throw new Error(t`The export was not requested. Use the choice shown.`);
    }
    throw new Error(t`The export could not be requested. Try again.`);
  };
}

function ExportStatus(props: {
  readonly row: AccountPrivacyRow | null;
  readonly phase: ExportPhase;
}): JSX.Element {
  const { t } = useLingui();
  const { i18n } = useLinguiRuntime();
  const readyBy = () => {
    const ms = exportReadyByMs(props.row?.requested_at);
    return ms === null ? '' : formatPrivacyMoment(ms, i18n().locale);
  };
  return (
    <>
      <Show when={props.phase === 'preparing'}>
        <P testId="privacy-export-preparing">
          <Trans>
            Your personal-data export is being prepared. It will be ready within
            24 hours of asking.
          </Trans>
        </P>
        <P tone="secondary" testId="privacy-export-deadline">
          {t`Ready by ${readyBy()}`}
        </P>
      </Show>
      <Show when={props.phase === 'overdue'}>
        <P tone="destructive" testId="privacy-export-overdue">
          {t`Your export is late: it was due by ${readyBy()}. You can ask again, which starts a new export.`}
        </P>
      </Show>
      <Show when={props.row?.export_status === 'ExportFailed'}>
        <P tone="destructive" testId="privacy-export-failed">
          <Trans>
            The export failed. You can ask again. No incomplete export is
            available.
          </Trans>
        </P>
      </Show>
    </>
  );
}

export function ExportChoice(props: {
  readonly row: AccountPrivacyRow | null;
}): JSX.Element {
  const { t } = useLingui();
  const [denial, setDenial] = createSignal<Decision | null>(null);
  const [replacing, setReplacing] = createSignal(false);
  const phase = useExportPhase(() => props.row);
  const requestExport = useExportRequest((decision) => {
    setDenial(decision);
    setReplacing(false);
  });
  const request = useMutationButton({
    operation: async () => {
      setDenial(null);
      await requestExport();
    },
    labels: {
      idle: t`Request personal-data export`,
      loading: t`Requesting…`,
      success: t`Export requested`,
      error: t`Try again`,
    },
  });
  return (
    <StackVertical gap="md">
      <Show
        when={phase() === 'readyToReplace'}
        fallback={
          <Button
            {...request.buttonProps}
            dataSet={{ testid: 'privacy-export-request' }}
          />
        }
      >
        <Button
          title={t`Request personal-data export`}
          onClick={() => setReplacing(true)}
          dataSet={{ testid: 'privacy-export-request' }}
        />
      </Show>
      <Show when={denial()} keyed>
        {(decision) => (
          <DenialSurface decision={decision} testId="privacy-export-denial" />
        )}
      </Show>
      <ExportStatus row={props.row} phase={phase()} />
      <MutationModal
        visible={replacing()}
        onClose={() => setReplacing(false)}
        title={t`Replace your ready export?`}
        message={t`Asking again replaces the export that is ready now, and it can no longer be downloaded. Download it first if you want to keep it.`}
        operation={async () => {
          setDenial(null);
          await requestExport();
        }}
        submitLabel={t`Ask for a new export`}
        successTitle={t`New export requested`}
        successBody={t`It will be ready within 24 hours.`}
        submitDataSet={{ testid: 'privacy-export-replace-confirm' }}
        dataSet={{ testid: 'privacy-export-replace-modal' }}
      />
    </StackVertical>
  );
}
