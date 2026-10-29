import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { useParams } from '@solidjs/router';
import { type JSX, Show } from 'solid-js';
import { resourceValue } from './resource-value';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { SyntheticPopulationEventTimeline } from './synthetic-population-event-timeline';
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
    <ContentScreen
      screenId="synthetic-user"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        {
          name: <Trans>Bot Observatory</Trans>,
          href: '/admin/synthetic-population',
        },
        { name: <Trans>Synthetic User</Trans> },
      ]}
    >
      <Show when={inspector.record.error}>
        <ErrorState
          variant="compact"
          title={<Trans>Synthetic User could not be loaded.</Trans>}
          body={<Trans>Refresh to try again.</Trans>}
        />
      </Show>
      <Show when={inspector.record.loading}>
        <LoadingState
          variant="compact"
          caption={<Trans>Reading activity…</Trans>}
        />
      </Show>
      <Button
        title={t`Refresh`}
        onClick={() => {
          void inspector.refetch();
        }}
      />
      <Show when={resourceValue(inspector.record)}>
        {(value) => (
          <>
            <SyntheticUserDetails user={value().user} />
            <SyntheticUserControls command={inspector.command} />
            <SyntheticUserStatechart
              activity={value().user.activity}
              snapshot={inspector.snapshot()}
            />
            <SyntheticPopulationEventTimeline events={value().events} />
            <SyntheticUserReplay userId={value().user.id} />
            <SyntheticUserDom
              snapshot={inspector.snapshot()}
              inspect={() => inspector.command('inspect')}
            />
          </>
        )}
      </Show>
    </ContentScreen>
  );
}
export function SyntheticUserScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationInspect);
  return (
    <Show
      when={decision().allowed}
      fallback={
        <SyntheticPopulationDenial
          permission={PERMISSION.syntheticPopulationInspect}
          testId="synthetic-population-inspect-denied"
        />
      }
    >
      <SyntheticUserContent />
    </Show>
  );
}
