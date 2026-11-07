import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type JSX, Show } from 'solid-js';
import type { PrivacyActionAccess } from './privacy-action-access';
import { exportReadyByMs, formatPrivacyMoment } from './privacy-dates';
import type { ExportPhase } from './privacy-export-state';
import type { AccountPrivacyRow } from './use-account-privacy';

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

export type ExportChoiceProps = {
  readonly access: PrivacyActionAccess;
  readonly row: AccountPrivacyRow | null;
  readonly phase: ExportPhase;
  /** Why the last request was refused, with its way forward. */
  readonly denial?: DenialView | undefined;
  /** The replace-your-ready-export confirmation is open. */
  readonly replacing: boolean;
  /** Asks for a new export; rejects with the message the button shows. */
  readonly onRequest: () => Promise<void>;
  readonly onReviewReplace: () => void;
  readonly onCancelReplace: () => void;
};

/**
 * The export request: a button (confirm-first while a ready export would be
 * replaced), any refusal, and where the export stands.
 */
function ExportRequestControl(props: {
  readonly choice: ExportChoiceProps;
  readonly request: ReturnType<typeof useMutationButton>;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show
        when={
          props.choice.access.kind === 'allowed' ||
          props.request.feedback() !== 'idle'
        }
      >
        <Show
          when={props.choice.phase === 'readyToReplace'}
          fallback={
            <Button
              {...props.request.buttonProps}
              dataSet={{ testid: 'privacy-export-request' }}
            />
          }
        >
          <Button
            title={t`Request personal-data export`}
            onClick={() => props.choice.onReviewReplace()}
            dataSet={{ testid: 'privacy-export-request' }}
          />
        </Show>
      </Show>
      <Show
        when={
          props.choice.access.kind === 'denied'
            ? props.choice.access.denial
            : undefined
        }
      >
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
    </>
  );
}

export function ExportChoice(props: ExportChoiceProps): JSX.Element {
  const { t } = useLingui();
  const request = useMutationButton({
    operation: () => props.onRequest(),
    labels: {
      idle: t`Request personal-data export`,
      loading: t`Requesting…`,
      success: t`Export requested`,
      error: t`Try again`,
    },
  });
  return (
    <StackVertical gap="md">
      <ExportRequestControl choice={props} request={request} />
      <Show when={props.denial}>
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
      <ExportStatus row={props.row} phase={props.phase} />
      <MutationModal
        visible={props.replacing}
        onClose={() => props.onCancelReplace()}
        title={t`Replace your ready export?`}
        message={t`Asking again replaces the export that is ready now, and it can no longer be downloaded. Download it first if you want to keep it.`}
        operation={() => props.onRequest()}
        submitLabel={t`Ask for a new export`}
        successTitle={t`New export requested`}
        successBody={t`It will be ready within 24 hours.`}
        submitDataSet={{ testid: 'privacy-export-replace-confirm' }}
        dataSet={{ testid: 'privacy-export-replace-modal' }}
      />
    </StackVertical>
  );
}
