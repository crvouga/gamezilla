import { createMemo, Show } from 'solid-js';
import { Header } from '../components/header';
import { HelpModal } from '../components/help-modal';
import type { ReportData } from '../types';
import { ListView } from '../views/list-view';
import { TestView } from '../views/test-view';
import { ReportProvider } from './report-context';
import { useReportNav } from './use-report-nav';
import '../styles.css';

export type SimReportAppProps = {
  data: ReportData;
  frameCss?: string;
};

export function SimReportApp(props: SimReportAppProps) {
  const nav = useReportNav(props.data);
  const isTest = createMemo(() => nav.route().view === 'test');

  return (
    <ReportProvider
      data={props.data}
      {...(props.frameCss !== undefined ? { frameCss: props.frameCss } : {})}
    >
      <div class="sim-report-root sr-app">
        <Header nav={nav} />
        <div class="sr-content" classList={{ 'sr-content-scroll': !isTest() }}>
          <Show when={isTest()} fallback={<ListView nav={nav} />}>
            <TestView nav={nav} />
          </Show>
        </div>
        <Show when={nav.showHelp()}>
          <HelpModal onClose={() => nav.toggleHelp()} />
        </Show>
        <div class="sr-hints">← → scrub · Space play · ? help</div>
      </div>
    </ReportProvider>
  );
}
