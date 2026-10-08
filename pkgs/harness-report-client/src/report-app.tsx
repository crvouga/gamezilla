import { useLingui } from '@lingui/solid/macro';
import { catalogParams } from '@pkgs/harness-report-shared/catalog';
import type { SourceRecord } from '@pkgs/harness-report-shared/protocol';
import type { ReportData } from '@pkgs/harness-report-shared/types';
import { Notice } from '@pkgs/ui-root-client/notice';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import type { ScreenBaseBreadcrumb } from '@pkgs/ui-root-client/screen-base-types';
import { createMemo, Show } from 'solid-js';
import { CommandPalette } from './command-palette';
import type { ExplorerResource } from './explorer-resource';
import { HelpModal } from './help-modal';
import { ListView } from './list-view';
import type { ReportNavigation } from './navigation';
import type { RemoteReportPhase } from './remote-report';
import type { ReportTestLoader } from './report-context';
import { ReportProvider } from './report-context';
import { ReportExplorer } from './report-explorer';
import { TestView } from './test-view';
import { useReportNav } from './use-report-nav';
import './styles.css';

export type HarnessReportAppProps = {
  data: ReportData;
  navigation: ReportNavigation;
  frameCss?: string | undefined;
  loader?: ReportTestLoader | undefined;
  pending?: boolean | undefined;
  home?: { readonly label: string; readonly onOpen: () => void } | undefined;
  explorer?: ExplorerResource;
  sources?: readonly SourceRecord[];
  sha?: string;
  phase?: RemoteReportPhase;
  onRefresh?: () => void;
};

export function HarnessReportApp(props: HarnessReportAppProps) {
  const { t } = useLingui();
  const nav = useReportNav(props.data, props.navigation);
  const isTest = createMemo(() => nav.route().view === 'test');
  const breadcrumbs = (): readonly ScreenBaseBreadcrumb[] => [
    ...(props.home
      ? [{ name: props.home.label, onClick: props.home.onOpen }]
      : []),
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
          actions={[
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
          content={() => (
            <div class="box flex-1 min-h-0 min-w-0 gap-3">
              <Show when={props.phase === 'error'}>
                <Notice tone="error">{t`Recorded test reports could not be loaded. The reports store may be unavailable or this environment may lack its read credential. Refresh to try again. Available specs and evidence remain below.`}</Notice>
              </Show>
              <Show when={props.phase === 'missing'}>
                <Notice>{t`No test run has been published for this commit. Its specs and independently completed report parts remain available below.`}</Notice>
              </Show>
              <Show when={props.phase === 'live'}>
                <Notice>{t`Verification is running. Completed test reports are available as they arrive.`}</Notice>
              </Show>
              <Show
                when={isTest()}
                fallback={
                  <Show
                    when={props.explorer}
                    keyed
                    fallback={<ListView nav={nav} />}
                  >
                    {(resource) => (
                      <ReportExplorer
                        nav={nav}
                        resource={resource}
                        sources={props.sources ?? []}
                        sha={props.sha ?? ''}
                      />
                    )}
                  </Show>
                }
              >
                <TestView nav={nav} />
              </Show>
            </div>
          )}
        />
        <Show when={nav.showHelp()}>
          <HelpModal onClose={nav.closeHelp} />
        </Show>
        <CommandPalette nav={nav} />
      </div>
    </ReportProvider>
  );
}
