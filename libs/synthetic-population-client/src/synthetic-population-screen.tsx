import { useCan, useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { Button } from '@pkgs/ui-root-client/button';
import { FormActionsFooter } from '@pkgs/ui-root-client/form-actions-footer';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { createResource, type JSX, Show } from 'solid-js';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import {
  SyntheticPopulationConfiguration,
  useSyntheticPopulationConfiguration,
} from './synthetic-population-configuration';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { SyntheticPopulationEventTimeline } from './synthetic-population-event-timeline';
import { SyntheticPopulationSummary } from './synthetic-population-summary';
import { SyntheticPopulationUsers } from './synthetic-population-users';
import { SyntheticPopulationWorkers } from './synthetic-population-workers';
import { useSyntheticPopulationUpdates } from './use-synthetic-population-updates';

function SyntheticPopulationContent(): JSX.Element {
  const { t } = useLingui();
  const api = useSyntheticPopulationApi();
  const router = useRouter();
  const configure = useCan(PERMISSION.syntheticPopulationConfigure);
  const inspect = useCan(PERMISSION.syntheticPopulationInspect);
  const draft = useSyntheticPopulationConfiguration();
  const [overview, { refetch }] = createResource(async () => {
    const result = await api.overview();
    draft.initialize(result.config);
    return result;
  });
  const candidate = () => draft.candidate(overview()?.config);
  useSyntheticPopulationUpdates(() => refetch());
  const save = async () => {
    const value = candidate();
    if (value === null)
      throw new Error(t`Enter a valid desired synthetic population.`);
    await api.configure(value);
    await refetch();
  };
  return (
    <ScreenBase
      screenId="synthetic-population"
      scroll
      breadcrumbs={[
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Bot Observatory</Trans> },
      ]}
      footer={
        <Show when={configure()}>
          <FormActionsFooter
            submit={{
              label: t`Save synthetic population`,
              loadingLabel: t`Saving…`,
              successLabel: t`Saved`,
              operation: save,
              get disabled() {
                return candidate() === null;
              },
              dataSet: { testid: 'synthetic-population-save' },
            }}
          />
        </Show>
      }
      content={() => (
        <div class="box gap-6">
          <Show when={overview.loading}>
            <p class="text" role="status">
              <Trans>Reading Synthetic Population…</Trans>
            </p>
          </Show>
          <Show when={overview.error}>
            <p class="text text-destructive" role="alert">
              <Trans>Bot Observatory could not be loaded.</Trans>
            </p>
          </Show>
          <Button
            title={t`Refresh`}
            onClick={() => {
              void refetch();
            }}
          />
          <Show when={overview()} keyed>
            {(value) => (
              <>
                <SyntheticPopulationSummary overview={value} />
                <Show when={configure()}>
                  <SyntheticPopulationConfiguration
                    fields={draft.fields()}
                    change={draft.change}
                  />
                </Show>
                <SyntheticPopulationUsers
                  observedAtMs={value.observedAtMs}
                  canInspect={inspect()}
                  inspect={(id) =>
                    router.push(`/admin/synthetic-population/users/${id}`)
                  }
                />
                <SyntheticPopulationWorkers overview={value} />
                <SyntheticPopulationEventTimeline
                  events={value.events.filter(
                    (event) => event.event !== 'UiDriverAction'
                  )}
                />
              </>
            )}
          </Show>
        </div>
      )}
    />
  );
}

export function SyntheticPopulationScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationView);
  return (
    <Show
      when={decision().allowed}
      fallback={
        <SyntheticPopulationDenial
          permission={PERMISSION.syntheticPopulationView}
          testId="synthetic-population-denied"
        />
      }
    >
      <SyntheticPopulationContent />
    </Show>
  );
}

export function SyntheticPopulationConfigurationScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationConfigure);
  return (
    <Show
      when={decision().allowed}
      fallback={
        <SyntheticPopulationDenial
          permission={PERMISSION.syntheticPopulationConfigure}
          testId="synthetic-population-config-denied"
        />
      }
    >
      <SyntheticPopulationContent />
    </Show>
  );
}
