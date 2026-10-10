import { useCan, useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import {
  type PopulationConfig,
  populationConfigSchema,
} from '@libs/population-shared/config';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { Button } from '@pkgs/ui-root-client/button';
import { FormActionsFooter } from '@pkgs/ui-root-client/form-actions-footer';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { createResource, createSignal, type JSX, Show } from 'solid-js';
import { usePopulationApi } from './population-api';
import { PopulationDenial } from './population-denial';
import { PopulationEventTimeline } from './population-event-timeline';
import { PopulationSummary } from './population-summary';
import { PopulationUsers } from './population-users';
import { PopulationWorkers } from './population-workers';
import { usePopulationUpdates } from './use-population-updates';

function PopulationContent(): JSX.Element {
  const { t } = useLingui();
  const api = usePopulationApi();
  const router = useRouter();
  const configure = useCan(PERMISSION.populationConfigure);
  const inspect = useCan(PERMISSION.populationInspect);
  const [desired, setDesired] = createSignal('');
  let initialized = false;
  const [overview, { refetch }] = createResource(async () => {
    const result = await api.overview();
    if (!initialized) {
      initialized = true;
      setDesired(String(result.config.desired));
    }
    return result;
  });
  const candidate = (): PopulationConfig | null => {
    const current = overview();
    if (current === undefined || !/^\d+$/.test(desired())) return null;
    const parsed = populationConfigSchema.safeParse({
      ...current.config,
      desired: Number(desired()),
    });
    return parsed.success ? parsed.data : null;
  };
  usePopulationUpdates(() => refetch());
  const save = async () => {
    const value = candidate();
    if (value === null) throw new Error(t`Enter a valid desired population.`);
    await api.configure(value);
    await refetch();
  };
  return (
    <ScreenBase
      screenId="population"
      scroll
      breadcrumbs={[
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Bot Observatory</Trans> },
      ]}
      footer={
        <Show when={configure()}>
          <FormActionsFooter
            submit={{
              label: t`Save population`,
              loadingLabel: t`Saving…`,
              successLabel: t`Saved`,
              operation: save,
              get disabled() {
                return candidate() === null;
              },
              dataSet: { testid: 'population-save' },
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
                <PopulationSummary overview={value} />
                <Show when={configure()}>
                  <MenuSection title={<Trans>Configuration</Trans>}>
                    <TextInput
                      label={t`Desired population`}
                      type="number"
                      value={desired()}
                      onChangeText={setDesired}
                      dataSet={{ testid: 'population-desired-input' }}
                    />
                  </MenuSection>
                </Show>
                <PopulationUsers
                  users={value.users}
                  canInspect={inspect()}
                  inspect={(id) => router.push(`/admin/population/users/${id}`)}
                />
                <PopulationWorkers overview={value} />
                <PopulationEventTimeline
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

export function PopulationScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.populationView);
  return (
    <Show
      when={decision().allowed}
      fallback={
        <PopulationDenial
          permission={PERMISSION.populationView}
          testId="population-denied"
        />
      }
    >
      <PopulationContent />
    </Show>
  );
}

export function PopulationConfigurationScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.populationConfigure);
  return (
    <Show
      when={decision().allowed}
      fallback={
        <PopulationDenial
          permission={PERMISSION.populationConfigure}
          testId="population-config-denied"
        />
      }
    >
      <PopulationContent />
    </Show>
  );
}
