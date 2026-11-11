import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { DataTable } from '@pkgs/ui-root-client-ts/data-table';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type JSX, Show } from 'solid-js';
import type { SyntheticUserReplayResult } from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';
import { syntheticUserCrumbs } from './synthetic-population-frame';
import type { SyntheticUserName } from './synthetic-user-events-screen-view';
import { useMomentLabel } from './synthetic-user-labels';

type ReplayedDecision = SyntheticUserReplayResult['decisions'][number];

export type SyntheticUserReplayScreenViewProps = {
  /** Set when the person may not replay decisions; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** Whose decisions, once read; names the way back to its control panel. */
  readonly user: SyntheticUserName | undefined;
  /** The last replay's outcome, or null before the first replay. */
  readonly result: SyntheticUserReplayResult | null;
  /** Runs a replay; its button shows progress and outcome. */
  readonly onReplay: () => Promise<void>;
};

function OutcomeBadge(props: { decision: ReplayedDecision }): JSX.Element {
  const { t } = useLingui();
  const outcome = () => props.decision.result;
  return (
    <StackHorizontal gap="xs">
      <Show
        when={outcome()}
        fallback={
          <Badge label={t`Inputs unavailable`} intent="neutral" size="sm" />
        }
      >
        {(result) => (
          <Badge
            label={result().matches ? t`Choice reproduced` : t`Policy changed`}
            intent={result().matches ? 'success' : 'warning'}
            size="sm"
          />
        )}
      </Show>
    </StackHorizontal>
  );
}

function useDecisionColumns(): () => readonly TableColumn<ReplayedDecision>[] {
  const { t } = useLingui();
  const moment = useMomentLabel();
  return () => [
    {
      key: 'when',
      header: t`Recorded`,
      primary: true,
      sortValue: (decision) => Date.parse(decision.createdAt),
      render: (decision) => moment(decision.createdAt),
    },
    {
      key: 'outcome',
      header: t`Outcome`,
      width: 'min',
      render: (decision) => <OutcomeBadge decision={decision} />,
    },
    {
      key: 'version',
      header: t`Version`,
      render: (decision) => decision.version ?? t`Unknown`,
    },
    {
      key: 'event',
      header: t`Event`,
      render: (decision) => <Text variant="mono">{decision.eventId}</Text>,
    },
  ];
}

function ReplayScreen(props: SyntheticUserReplayScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const columns = useDecisionColumns();
  const action = useMutationButton({
    labels: {
      idle: t`Replay decisions`,
      success: t`Replay completed`,
      error: t`Try again`,
    },
    operation: () => props.onReplay(),
  });
  return (
    <ContentScreen
      screenId="synthetic-user-replay"
      breadcrumbs={syntheticUserCrumbs(props.user, {
        name: <Trans>Decision replay</Trans>,
      })}
      width="list"
    >
      <StackVertical gap="xl">
        <MenuSection
          title={<Trans>Decision Policy replay</Trans>}
          footer={
            <Trans>
              Replays recorded choices and random inputs. Application timing and
              external services are not replayed.
            </Trans>
          }
        >
          <MenuRow
            title={<Trans>Recorded decisions</Trans>}
            caption={
              props.result === null
                ? t`Not replayed yet`
                : t`Replayed with the current Decision Policy`
            }
            trailing={
              <Button
                {...action.buttonProps}
                intent="neutral"
                variant="outline"
                size="sm"
                dataSet={{ testid: 'synthetic-population-replay' }}
              />
            }
          />
        </MenuSection>
        <DataTable
          caption={t`Replayed decisions`}
          columns={columns()}
          rows={props.result?.decisions ?? []}
          rowKey={(decision) => decision.eventId}
          defaultSort={{ key: 'when', direction: 'descending' }}
          loading={false}
          loadingLabel={t`Replaying decisions…`}
          empty={
            props.result === null
              ? {
                  title: t`Not replayed yet`,
                  body: t`Replay decisions to see whether each recorded choice is made again.`,
                }
              : {
                  title: t`No recorded decisions`,
                  body: t`Decisions appear once this Synthetic User makes choices.`,
                }
          }
          testId="synthetic-population-replayed"
        />
      </StackVertical>
    </ContentScreen>
  );
}

/**
 * `/admin/observatory/synthetic-users/:id/replay`, presentational: replays
 * one Synthetic User's recorded decisions with the current Decision Policy
 * (the button shows progress, success and a retry) and lists whether each
 * choice was reproduced; before the first replay the table says so. Its
 * denied state replaces it. `SyntheticUserReplayScreen` wires it.
 */
export function SyntheticUserReplayScreenView(
  props: SyntheticUserReplayScreenViewProps
): JSX.Element {
  return (
    <Show when={props.denial} fallback={<ReplayScreen {...props} />}>
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}
