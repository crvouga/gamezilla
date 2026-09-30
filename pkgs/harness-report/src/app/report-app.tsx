import { createMemo, Show } from 'solid-js';
import { CommandPalette } from '../components/command-palette';
import { Header } from '../components/header';
import { HelpModal } from '../components/help-modal';
import type { ReportData } from '../types';
import { ListView } from '../views/list-view';
import { TestView } from '../views/test-view';
import { ReportProvider, type ReportTestLoader } from './report-context';
import { useReportNav } from './use-report-nav';
import '../styles.css';

export type HarnessReportAppProps = {
  data: ReportData;
  frameCss?: string | undefined;
  /** Loads each test's steps on first view; frame files follow as they paint. */
  loader?: ReportTestLoader | undefined;
  /** True while the test list itself is still arriving. */
  pending?: boolean;
  /** A way out of this report (a list of reports), shown in the header. */
  home?: { readonly label: string; readonly onOpen: () => void } | undefined;
};

export function HarnessReportApp(props: HarnessReportAppProps) {
  const nav = useReportNav(props.data);
  const isTest = createMemo(() => nav.route().view === 'test');

  return (
    <ReportProvider
      data={props.data}
      frameCss={props.frameCss}
      loader={props.loader}
      pending={props.pending}
    >
      <div class="harness-report-root sr-app">
        <Header nav={nav} home={props.home} />
        <div class="sr-content" classList={{ 'sr-content-scroll': !isTest() }}>
          <Show when={isTest()} fallback={<ListView nav={nav} />}>
            <TestView nav={nav} />
          </Show>
        </div>
        <Show when={nav.showHelp()}>
          <HelpModal onClose={() => nav.toggleHelp()} />
        </Show>
        <CommandPalette nav={nav} />
      </div>
    </ReportProvider>
  );
}
