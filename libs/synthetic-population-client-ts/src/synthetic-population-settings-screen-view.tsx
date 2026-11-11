import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { FormScreen } from '@pkgs/ui-root-client-ts/form-screen';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { type JSX, Match, Show, Switch } from 'solid-js';
import {
  type ConfigurationDraft,
  type ConfigurationField,
  SyntheticPopulationConfiguration,
} from './synthetic-population-configuration';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { panelCrumbs } from './synthetic-population-frame';

export type SyntheticPopulationSettingsScreenViewProps = {
  /** Set when the person may not configure; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** The saved settings have been read, so the form can be edited. */
  readonly ready: boolean;
  /** The first read is under way. */
  readonly loading: boolean;
  /** The first read failed; its retry reads again. */
  readonly failed: boolean;
  readonly onRetry: () => void;
  /** The form as typed. */
  readonly fields: ConfigurationDraft;
  /** The typed settings are valid and known; otherwise Save is disabled. */
  readonly canSave: boolean;
  readonly onChangeField: (field: ConfigurationField, value: string) => void;
  /** Saves the typed settings; the footer shows its progress. */
  readonly onSave: () => Promise<void>;
  /** Leaves the form without saving. */
  readonly onCancel: () => void;
};

function SettingsForm(
  props: SyntheticPopulationSettingsScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <FormScreen
      screenId="synthetic-population-settings"
      breadcrumbs={panelCrumbs([{ name: <Trans>Population settings</Trans> }])}
      submit={{
        label: t`Save synthetic population`,
        loadingLabel: t`Saving…`,
        successLabel: t`Saved`,
        operation: () => props.onSave(),
        get disabled() {
          return !props.ready || !props.canSave;
        },
        dataSet: { testid: 'synthetic-population-save' },
      }}
      cancel={{ label: t`Cancel`, onClick: () => props.onCancel() }}
    >
      <Switch>
        <Match when={props.ready}>
          <SyntheticPopulationConfiguration
            fields={props.fields}
            change={props.onChangeField}
          />
        </Match>
        <Match when={props.failed}>
          <ErrorState
            variant="compact"
            title={<Trans>Population settings could not be loaded.</Trans>}
            body={<Trans>Check your connection and try again.</Trans>}
            retry={{ onClick: () => props.onRetry() }}
          />
        </Match>
        <Match when={props.loading}>
          <LoadingState
            variant="compact"
            caption={<Trans>Reading population settings…</Trans>}
          />
        </Match>
      </Switch>
    </FormScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users/settings`, presentational: the
 * desired synthetic population form, the only form on its screen, with
 * Save and Cancel in the footer. Until the saved settings are read it
 * shows loading or a retryable failure and Save stays disabled, so nothing
 * unknown is saved over; its denied state replaces it.
 * `SyntheticPopulationSettingsScreen` wires it.
 */
export function SyntheticPopulationSettingsScreenView(
  props: SyntheticPopulationSettingsScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<SettingsForm {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
