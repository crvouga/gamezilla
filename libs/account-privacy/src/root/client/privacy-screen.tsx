import { DenialSurface } from '@libs/permissions/public/denial-surface';
import { useParams } from '@solidjs/router';
import { useMyId } from '@libs/auth/public/use-current-user';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button, MutationModal, ScreenBase } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';
import { useAccountDeletion } from '../../use-cases/confirm-account-deletion/client/use-account-deletion';
import { ExportDownload } from '../../use-cases/download-personal-data-export/client/export-download';
import { useAccountPrivacy } from '../../use-cases/hydrate-account-privacy/client/use-account-privacy';
import { ExportChoice } from '../../use-cases/request-personal-data-export/client/export-choice';
import { PrivacyExplanation } from './privacy-explanation';

export function PrivacyScreen(): JSX.Element {
  const { t } = useLingui();
  const params = useParams();
  const myId = useMyId();
  const deletion = useAccountDeletion();
  const row = useAccountPrivacy();
  return (
    <ScreenBase
      screenId="account-privacy"
      scroll
      breadcrumbs={[{ name: <Trans>Account privacy</Trans> }]}
      content={() => (
        <div class="box gap-4">
          <PrivacyExplanation />
          <Show when={row()?.legal_purpose}>
            <p class="text" data-testid="privacy-legal-obligation">
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
              <DenialSurface
                decision={decision}
                testId="privacy-delete-denial"
              />
            )}
          </Show>
          <Show when={deletion.receipt()}>
            <p class="text" data-testid="privacy-deletion-outcome">
              <Trans>
                Your account deletion is confirmed. You are signed out. Ordinary
                personal-data erasure will complete by
              </Trans>{' '}
              {deletion.receipt()}
            </p>
          </Show>
          <MutationModal
            visible={deletion.confirming()}
            onClose={deletion.cancel}
            title={t`Permanently delete account?`}
            message={t`This cannot be undone. Every device will be signed out. Your hosted spaces and future membership charges will end. Take an export first if you want a copy of your personal data.`}
            operation={deletion.confirm}
            submitLabel={t`Confirm permanent deletion`}
            variant="destructive"
            successTitle={t`Account deletion confirmed`}
            successBody={t`Ordinary personal data will be erased within 30 days.`}
            submitDataSet={{ testid: 'privacy-delete-confirm' }}
            dataSet={{ testid: 'privacy-delete-modal' }}
          />
        </div>
      )}
    />
  );
}
