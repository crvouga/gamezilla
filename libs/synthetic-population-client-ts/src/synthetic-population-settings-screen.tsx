import { SYNTHETIC_USERS_PATH } from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_SYNTHETIC_POPULATION_CONFIG } from '@libs/synthetic-population-shared-ts/config';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import type { JSX } from '@solidjs/web';
import { createEffect } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import {
  toConfigurationDraft,
  useSyntheticPopulationConfiguration,
} from './synthetic-population-configuration';
import { SyntheticPopulationSettingsScreenView } from './synthetic-population-settings-screen-view';
import { useSyntheticPopulationOverview } from './use-synthetic-population-overview';

function SettingsContent(): JSX.Element {
  const { t } = useLingui();
  const api = useSyntheticPopulationApi();
  const router = useRouter();
  const draft = useSyntheticPopulationConfiguration();
  const population = useSyntheticPopulationOverview();
  // The form starts from the saved settings once; later reads keep the typing.
  createEffect(
    () => population.shown()?.config,
    (saved) => {
      if (saved !== undefined) draft.initialize(saved);
    }
  );
  const candidate = () => draft.candidate(population.shown()?.config);
  return (
    <SyntheticPopulationSettingsScreenView
      ready={population.shown() !== undefined}
      loading={population.loading()}
      failed={population.failed()}
      onRetry={() => {
        void population.reread();
      }}
      fields={draft.fields()}
      canSave={candidate() !== null}
      onChangeField={draft.change}
      onSave={async () => {
        const value = candidate();
        if (value === null)
          throw new Error(t`Enter a valid desired synthetic population.`);
        await api.configure(value);
        await population.reread();
      }}
      onCancel={() => router.push(SYNTHETIC_USERS_PATH)}
    />
  );
}

const INERT_FIELDS = toConfigurationDraft(DEFAULT_SYNTHETIC_POPULATION_CONFIG);

/** `/admin/observatory/synthetic-users/settings`: wires `SyntheticPopulationSettingsScreenView`, gated on configure. */
export function SyntheticPopulationSettingsScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationConfigure);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-config-denied"
      denied={(denial) => (
        <SyntheticPopulationSettingsScreenView
          denial={denial}
          ready={false}
          loading={false}
          failed={false}
          onRetry={() => undefined}
          fields={INERT_FIELDS}
          canSave={false}
          onChangeField={() => undefined}
          onSave={async () => undefined}
          onCancel={() => undefined}
        />
      )}
    >
      <SettingsContent />
    </DecisionGate>
  );
}
