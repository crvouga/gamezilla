import { useMyId } from '@libs/auth-client/use-current-user';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { useParams } from '@solidjs/router';
import { type JSX, Show } from 'solid-js';
import { ExportChoice } from './export-choice';
import { ExportDownload } from './export-download';
import { formatPrivacyDay, timestampMs } from './privacy-dates';
import { PrivacyExplanation } from './privacy-explanation';
import { useAccountDeletion } from './use-account-deletion';
import { useAccountPrivacy } from './use-account-privacy';

export function PrivacyScreen(): JSX.Element {
  const { t } = useLingui();
  const params = useParams();
  const myId = useMyId();
  const { i18n } = useLinguiRuntime();
  const deletion = useAccountDeletion();
  const row = useAccountPrivacy();
  const eraseBy = () => {
    const ms = timestampMs(deletion.receipt());
    return ms === null ? '' : formatPrivacyDay(ms, i18n().locale);
  };
  return (
    <ContentScreen
      screenId="account-privacy"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/' },
        { name: <Trans>Account privacy</Trans> },
      ]}
    >
      <PrivacyExplanation />
      <Show when={row()?.legal_purpose}>
        <p class="text textBody" data-testid="privacy-legal-obligation">
          {row()?.legal_purpose}: {row()?.legal_end_condition}
        </p>
      </Show>
      <ExportChoice row={row()} />
      <ExportDownload row={row()} ownerId={params['accountId'] ?? myId()} />
      <Button
        title={t`Delete account`}
        intent="danger"
        onClick={deletion.review}
        dataSet={{ testid: 'privacy-delete-review' }}
      />
      <Show when={deletion.denial()} keyed>
        {(decision) => (
          <DenialSurface decision={decision} testId="privacy-delete-denial" />
        )}
      </Show>
      <Show when={deletion.receipt()}>
        <p class="text textBody" data-testid="privacy-deletion-outcome">
          {t`Your account deletion is confirmed. You are signed out. Ordinary personal-data erasure will complete by ${eraseBy()}.`}
        </p>
      </Show>
      <Show when={deletion.receipt()}>
        <p class="text textBody" data-testid="privacy-cancellation-outcome">
          <Show
            when={deletion.cancellationStatus() === 'complete'}
            fallback={
              <Trans>
                Membership cancellation is still being completed. Nothing more
                is needed from you.
              </Trans>
            }
          >
            <Trans>Membership cancellation has completed.</Trans>
          </Show>
        </p>
      </Show>
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
    </ContentScreen>
  );
}
