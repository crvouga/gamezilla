import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { usePermissions } from '@libs/permissions-client/use-permissions';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-client/button';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';
import type { AccountPrivacyRow } from './use-account-privacy';
import { requestPersonalDataExportMutation } from '@libs/account-privacy-shared/request-personal-data-export-mutation';

export function ExportChoice(props: {
  readonly row: AccountPrivacyRow | null;
}): JSX.Element {
  const { t } = useLingui();
  const client = useMutationClient();
  const permissions = usePermissions();
  const [denial, setDenial] = createSignal<Decision | null>(null);
  const request = useMutationButton({
    operation: async () => {
      const decision = permissions.can(PERMISSION.profileExportData);
      setDenial(decision.allowed ? null : decision);
      if (!decision.allowed)
        throw new Error(t`Use the choice shown below to continue.`);
      const result = await client.mutate(requestPersonalDataExportMutation, {});
      if (!result.ok)
        throw new Error(
          result.failures[0]?.message ?? t`The export could not be requested.`
        );
    },
    labels: {
      idle: t`Request personal-data export`,
      loading: t`Requesting…`,
      success: t`Export requested`,
      error: t`Try again`,
    },
  });
  return (
    <div class="box gap-3">
      <Button
        {...request.buttonProps}
        dataSet={{ testid: 'privacy-export-request' }}
      />
      <Show when={denial()} keyed>
        {(decision) => (
          <DenialSurface decision={decision} testId="privacy-export-denial" />
        )}
      </Show>
      <Show when={props.row?.export_status === 'Preparing'}>
        <p class="text" data-testid="privacy-export-preparing">
          <Trans>
            Your personal-data export is being prepared. It will be ready within
            24 hours of asking.
          </Trans>
        </p>
      </Show>
      <Show when={props.row?.requested_at}>
        <p class="text" data-testid="privacy-export-deadline">
          <Trans>Ready by</Trans>{' '}
          {new Date(
            Date.parse(props.row?.requested_at ?? '') + 86_400_000
          ).toISOString()}
        </p>
      </Show>
      <Show when={props.row?.export_status === 'ExportFailed'}>
        <p class="text" data-testid="privacy-export-failed">
          <Trans>
            The export failed. You can ask again. No incomplete export is
            available.
          </Trans>
        </p>
      </Show>
    </div>
  );
}
