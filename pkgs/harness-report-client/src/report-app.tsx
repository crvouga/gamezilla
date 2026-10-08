import { useLingui } from '@lingui/solid/macro';
import { catalogParams } from '@pkgs/harness-report-shared/catalog';
import type { SourceRecord } from '@pkgs/harness-report-shared/protocol';
import type { ReportData } from '@pkgs/harness-report-shared/types';
import { Button } from '@pkgs/ui-root-client/button';
import { Notice } from '@pkgs/ui-root-client/notice';
import { renderDefaultOverflowMenu } from '@pkgs/ui-root-client/overflow-menu-button';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import type { ScreenBaseBreadcrumb } from '@pkgs/ui-root-client/screen-base-types';
import { type Accessor, createMemo, type JSX, Show } from 'solid-js';
import { CommandPalette } from './command-palette';
import type { ExplorerResource } from './explorer-resource';
import { HelpModal } from './help-modal';
import { ListView } from './list-view';
import type { ReportNavigation } from './navigation';
import type { RemoteReportPhase } from './remote-report';
import type { ReportTestLoader } from './report-context';
import { ReportProvider } from './report-context';
import { ReportExplorer } from './report-explorer';
import { ReportOutcome } from './report-outcome';
import { TestView } from './test-view';
import { useReportNav } from './use-report-nav';
import './styles.css';

export type HarnessReportAppProps = {
  data: ReportData;
  navigation: ReportNavigation;
  frameCss?: string | undefined;
  loader?: ReportTestLoader | undefined;
  pending?: boolean | undefined;
  onOpenReports?: () => void;
  explorer?: ExplorerResource;
  sources?: readonly SourceRecord[];
  sha?: string;
  phase?: RemoteReportPhase;
  runUrl?: string | null | undefined;
  onRefresh?: () => void;
  onChooseRevision?: () => void;
};

function ReportContent(props: {
  app: HarnessReportAppProps;
  nav: ReturnType<typeof useReportNav>;
  isTest: Accessor<boolean>;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <div class="box flex-1 min-h-0 min-w-0 gap-3">
      <ReportOutcome
        phase={props.app.phase}
        status={props.app.data.status}
        hasFailingTests={props.app.data.tests.some(
          (test) => test.report.meta.status === 'failed'
        )}
        runUrl={props.app.runUrl}
      />
      <Show when={props.app.phase === 'error'}>
        <Notice tone="error">{t`Recorded test reports could not be loaded. The reports store may be unavailable or this environment may lack its read credential. Refresh to try again. Available specs and evidence remain below.`}</Notice>
      </Show>
      <Show when={props.app.phase === 'missing'}>
        <Notice>{t`No test run has been published for this commit. Its specs and independently completed report parts remain available below.`}</Notice>
      </Show>
      <Show when={props.app.phase === 'live'}>
        <Notice>{t`Verification is running. Completed test reports are available as they arrive.`}</Notice>
      </Show>
      <Show
        when={props.isTest()}
        fallback={
          <Show
            when={props.app.explorer}
            keyed
            fallback={<ListView nav={props.nav} />}
          >
            {(resource) => (
              <ReportExplorer
                nav={props.nav}
                resource={resource}
                sources={props.app.sources ?? []}
                sha={props.app.sha ?? ''}
              />
            )}
          </Show>
        }
      >
        <TestView nav={props.nav} />
      </Show>
    </div>
  );
}

export function HarnessReportApp(props: HarnessReportAppProps) {
  const { t } = useLingui();
  const nav = useReportNav(props.data, props.navigation);
  const isTest = createMemo(() => nav.route().view === 'test');
  const breadcrumbs = (): readonly ScreenBaseBreadcrumb[] => [
    {
      name: props.data.runId,
      ...(isTest()
        ? {
            onClick: () =>
              nav.navigate({
                view: 'list',
                params: catalogParams(nav.route().params),
              }),
          }
        : {}),
    },
    ...(isTest() ? [{ name: t`Recorded evidence` }] : []),
  ];
  const reportContent = (): JSX.Element => (
    <ReportContent app={props} nav={nav} isTest={isTest} />
  );
  return (
    <ReportProvider
      data={props.data}
      frameCss={props.frameCss}
      loader={props.loader}
      pending={props.pending}
    >
      <div class="harness-report-root box flex-1 min-h-0 min-w-0">
        <ScreenBase
          screenId="report-version"
          breadcrumbs={breadcrumbs()}
          leading={
            <Show when={props.onOpenReports} keyed>
              {(openReports) => (
                <Button
                  title={t`All reports`}
                  variant="ghost"
                  intent="neutral"
                  size="sm"
                  onClick={openReports}
                  dataSet={{ testid: 'report-all-reports' }}
                />
              )}
            </Show>
          }
          renderActionsMenu={renderDefaultOverflowMenu}
          actions={[
            ...(props.onChooseRevision
              ? [
                  {
                    type: 'secondary' as const,
                    label: t`Change revision`,
                    onClick: props.onChooseRevision,
                    overflow: 'never' as const,
                    dataSet: { testid: 'report-change-revision' },
                  },
                ]
              : []),
            ...(props.onRefresh
              ? [
                  {
                    type: 'secondary' as const,
                    label: t`Refresh`,
                    onClick: props.onRefresh,
                  },
                ]
              : []),
            {
              type: 'secondary',
              label: t`Shortcuts`,
              onClick: () => nav.toggleHelp(),
            },
          ]}
          content={reportContent}
        />
        <Show when={nav.showHelp()}>
          <HelpModal onClose={nav.closeHelp} />
        </Show>
        <CommandPalette nav={nav} />
      </div>
    </ReportProvider>
  );
}
