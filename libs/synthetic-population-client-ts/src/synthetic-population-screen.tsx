import { syntheticUserPath } from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import {
  type AppPermission,
  PERMISSION,
} from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_SYNTHETIC_POPULATION_CONFIG } from '@libs/synthetic-population-shared-ts/config';
import { useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createResource, type JSX } from 'solid-js';
import type { EveryCommand } from './every-synthetic-user-controls';
import { resourceValue } from './resource-value';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import {
  toConfigurationDraft,
  useSyntheticPopulationConfiguration,
} from './synthetic-population-configuration';
import { SyntheticPopulationScreenView } from './synthetic-population-screen-view';
import { SyntheticPopulationUsers } from './synthetic-population-users';
import {
  useRefreshWithoutUpdates,
  useSyntheticPopulationUpdates,
} from './use-synthetic-population-updates';

/** Without live updates, the panel is read again this often. */
const REFRESH_MS = 5_000;

function SyntheticPopulationContent(): JSX.Element {
  const { t } = useLingui();
  const api = useSyntheticPopulationApi();
  const router = useRouter();
  const configure = useCan(PERMISSION.syntheticPopulationConfigure);
  const inspect = useCan(PERMISSION.syntheticPopulationInspect);
  const control = useCan(PERMISSION.syntheticPopulationControl);
  const createId = useCreateId();
  const draft = useSyntheticPopulationConfiguration();
  const [overview, { refetch }] = createResource(async () => {
    const result = await api.overview();
    draft.initialize(result.config);
    return result;
  });
  const candidate = () => draft.candidate(resourceValue(overview)?.config);
  useSyntheticPopulationUpdates(() => refetch());
  useRefreshWithoutUpdates(() => refetch(), REFRESH_MS);
  const save = async () => {
    const value = candidate();
    if (value === null)
      throw new Error(t`Enter a valid desired synthetic population.`);
    await api.configure(value);
    await refetch();
  };
  const commandAll = async (command: EveryCommand) => {
    await api.commandAll({ command, operationId: createId() });
    await refetch();
  };
  return (
    <SyntheticPopulationScreenView
      loading={overview.loading}
      failed={Boolean(overview.error)}
      overview={resourceValue(overview)}
      canConfigure={configure()}
      fields={draft.fields()}
      canSave={candidate() !== null}
      onChangeField={draft.change}
      onSave={save}
      onRefresh={() => {
        void refetch();
      }}
      canControl={control()}
      onCommandAll={commandAll}
      directory={(observedAtMs) => (
        <SyntheticPopulationUsers
          observedAtMs={observedAtMs}
          canInspect={inspect()}
          canControl={control()}
          inspect={(id) => router.push(syntheticUserPath(id))}
        />
      )}
    />
  );
}

const INERT_FIELDS = toConfigurationDraft(DEFAULT_SYNTHETIC_POPULATION_CONFIG);

/** The view in its denied state: nothing behind the denial is read. */
function DeniedSyntheticPopulation(props: { denial: DenialView }): JSX.Element {
  return (
    <SyntheticPopulationScreenView
      denial={props.denial}
      loading={false}
      failed={false}
      overview={undefined}
      canConfigure={false}
      fields={INERT_FIELDS}
      canSave={false}
      onChangeField={() => undefined}
      onSave={async () => undefined}
      onRefresh={() => undefined}
      canControl={false}
      onCommandAll={async () => undefined}
    />
  );
}

function SyntheticPopulationRoute(props: {
  permission: AppPermission;
  testId: string;
}): JSX.Element {
  const decision = useDecision(props.permission);
  return (
    <DecisionGate
      decision={decision()}
      testId={props.testId}
      denied={(denial) => <DeniedSyntheticPopulation denial={denial} />}
    >
      <SyntheticPopulationContent />
    </DecisionGate>
  );
}

/** `/admin/observatory/synthetic-users`: the Synthetic Population panel. */
export function SyntheticPopulationScreen(): JSX.Element {
  return (
    <SyntheticPopulationRoute
      permission={PERMISSION.syntheticPopulationView}
      testId="synthetic-population-denied"
    />
  );
}

/** `/admin/observatory/synthetic-users/config`: the same panel, gated on configure. */
export function SyntheticPopulationConfigurationScreen(): JSX.Element {
  return (
    <SyntheticPopulationRoute
      permission={PERMISSION.syntheticPopulationConfigure}
      testId="synthetic-population-config-denied"
    />
  );
}

/** `/admin/observatory/synthetic-users/control`: the same panel, gated on control. */
export function SyntheticPopulationControlScreen(): JSX.Element {
  return (
    <SyntheticPopulationRoute
      permission={PERMISSION.syntheticPopulationControl}
      testId="synthetic-population-control-denied"
    />
  );
}
