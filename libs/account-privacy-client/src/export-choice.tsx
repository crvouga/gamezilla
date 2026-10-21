import { requestPersonalDataExportMutation } from '@libs/account-privacy-shared/request-personal-data-export-mutation';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { usePermissions } from '@libs/permissions-client/use-permissions';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { Button } from '@pkgs/ui-root-client/button';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';
import type { AccountPrivacyRow } from './use-account-privacy';

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
    <StackVertical gap="md">
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
        <P testId="privacy-export-preparing">
          <Trans>
            Your personal-data export is being prepared. It will be ready within
            24 hours of asking.
          </Trans>
        </P>
      </Show>
      <Show when={props.row?.requested_at}>
        <P tone="secondary" testId="privacy-export-deadline">
          <Trans>Ready by</Trans>{' '}
          {new Date(
            Date.parse(props.row?.requested_at ?? '') + 86_400_000
          ).toISOString()}
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
    </StackVertical>
  );
}
