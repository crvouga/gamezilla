import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { useParams } from '@solidjs/router';
import { type JSX, Show } from 'solid-js';
import { PopulationDenial } from './population-denial';
import { PopulationEventTimeline } from './population-event-timeline';
import { SyntheticUserControls } from './synthetic-user-controls';
import { SyntheticUserDetails } from './synthetic-user-details';
import { SyntheticUserDom } from './synthetic-user-dom';
import { SyntheticUserReplay } from './synthetic-user-replay';
import { SyntheticUserStatechart } from './synthetic-user-statechart';
import { useSyntheticUser } from './use-synthetic-user';

function SyntheticUserContent(): JSX.Element {
  const { t } = useLingui();
  const params = useParams();
  const inspector = useSyntheticUser(() => params['id'] ?? '');
  return (
    <ScreenBase
      screenId="synthetic-user"
      scroll
      breadcrumbs={[
        { name: <Trans>Bot Observatory</Trans>, href: '/admin/population' },
        { name: <Trans>Synthetic User</Trans> },
      ]}
      content={() => (
        <div class="box gap-6">
          <Show when={inspector.record.error}>
            <p class="text text-destructive" role="alert">
              <Trans>Synthetic User could not be loaded.</Trans>
            </p>
          </Show>
          <Show when={inspector.record.loading}>
            <p class="text" role="status">
              <Trans>Reading activity…</Trans>
            </p>
          </Show>
          <Button
            title={t`Refresh`}
            onClick={() => {
              void inspector.refetch();
            }}
          />
          <Show when={inspector.record()}>
            {(value) => (
              <>
                <SyntheticUserDetails user={value().user} />
                <SyntheticUserControls command={inspector.command} />
                <SyntheticUserStatechart
                  activity={value().user.activity}
                  snapshot={inspector.snapshot()}
                />
                <PopulationEventTimeline events={value().events} />
                <SyntheticUserReplay userId={value().user.id} />
                <SyntheticUserDom
                  snapshot={inspector.snapshot()}
                  inspect={() => inspector.command('inspect')}
                />
              </>
            )}
          </Show>
        </div>
      )}
    />
  );
}
export function SyntheticUserScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.populationInspect);
  return (
    <Show
      when={decision().allowed}
      fallback={
        <PopulationDenial
          permission={PERMISSION.populationInspect}
          testId="population-inspect-denied"
        />
      }
    >
      <SyntheticUserContent />
    </Show>
  );
}
