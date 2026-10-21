import { useMyId } from '@libs/auth-client/use-current-user';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { Notice } from '@pkgs/ui-root-client/notice';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import { useParams } from '@solidjs/router';
import { type JSX, Show } from 'solid-js';
import { ExportChoice } from './export-choice';
import { ExportDownload } from './export-download';
import { formatPrivacyDay, timestampMs } from './privacy-dates';
import { PrivacyExplanation } from './privacy-explanation';
import { PrivacyScreenLayout } from './privacy-screen-layout';
import { useAccountDeletion } from './use-account-deletion';
import { useAccountPrivacy } from './use-account-privacy';

/** The export controls and their status, once the privacy row is read. */
function PrivacyExport(): JSX.Element {
  const { t } = useLingui();
  const params = useParams();
  const myId = useMyId();
  const privacy = useAccountPrivacy();
  return (
    <Show
      when={!privacy.isLoading()}
      fallback={
        <LoadingState
          variant="compact"
          caption={t`Loading your privacy settings…`}
        />
      }
    >
      <StackVertical gap="lg">
        <Show when={privacy.row()?.legal_purpose}>
          <Notice dataSet={{ testid: 'privacy-legal-obligation' }}>
            {privacy.row()?.legal_purpose}: {privacy.row()?.legal_end_condition}
          </Notice>
        </Show>
        <ExportChoice row={privacy.row()} />
        <ExportDownload
          row={privacy.row()}
          ownerId={params['accountId'] ?? myId()}
        />
      </StackVertical>
    </Show>
  );
}

/** What a confirmed deletion did, once the receipt is on record. */
function DeletionOutcome(props: {
  readonly receipt: string;
  readonly cancellationComplete: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const { i18n } = useLinguiRuntime();
  const eraseBy = (): string => {
    const ms = timestampMs(props.receipt);
    return ms === null ? '' : formatPrivacyDay(ms, i18n().locale);
  };
  return (
    <StackVertical gap="sm">
      <P testId="privacy-deletion-outcome">
        {t`Your account deletion is confirmed. You are signed out. Ordinary personal-data erasure will complete by ${eraseBy()}.`}
      </P>
      <P tone="secondary" testId="privacy-cancellation-outcome">
        <Show
          when={props.cancellationComplete}
          fallback={
            <Trans>
              Membership cancellation is still being completed. Nothing more is
              needed from you.
            </Trans>
          }
        >
          <Trans>Membership cancellation has completed.</Trans>
        </Show>
      </P>
    </StackVertical>
  );
}

export function PrivacyScreen(): JSX.Element {
  const { t } = useLingui();
  const deletion = useAccountDeletion();
  return (
    <PrivacyScreenLayout>
      <StackVertical gap="2xl">
        <PrivacyExplanation />
        <PrivacyExport />
        <StackVertical gap="md">
          <Button
            title={t`Delete account`}
            intent="danger"
            onClick={deletion.review}
            dataSet={{ testid: 'privacy-delete-review' }}
          />
          <Show when={deletion.denial()} keyed>
            {(decision) => (
              <DenialSurface
                decision={decision}
                testId="privacy-delete-denial"
              />
            )}
          </Show>
          <Show when={deletion.receipt()}>
            {(receipt) => (
              <DeletionOutcome
                receipt={receipt()}
                cancellationComplete={
                  deletion.cancellationStatus() === 'complete'
                }
              />
            )}
          </Show>
        </StackVertical>
      </StackVertical>
      <MutationModal
        visible={deletion.confirming()}
        onClose={deletion.cancel}
        title={t`Permanently delete account?`}
        message={t`This cannot be undone. Every device will be signed out. Your hosted spaces and future membership charges will end. If you have Plus, Plus ends at once: the remaining paid time and Plus credit are not refunded. Take an export first if you want a copy of your personal data.`}
        operation={deletion.confirm}
        submitLabel={t`Confirm permanent deletion`}
        variant="destructive"
        successTitle={t`Account deletion confirmed`}
        successBody={t`Ordinary personal data will be erased within 30 days.`}
        submitDataSet={{ testid: 'privacy-delete-confirm' }}
        dataSet={{ testid: 'privacy-delete-modal' }}
      />
    </PrivacyScreenLayout>
  );
}
