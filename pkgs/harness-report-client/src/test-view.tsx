import { useLingui } from '@lingui/solid/macro';
import {
  frameFilesNear,
  selectedFrame,
  testFrames,
} from '@pkgs/harness-report-shared/frames';
import { Notice } from '@pkgs/ui-root-client/notice';
import { createEffect, createMemo, Match, Show, Switch } from 'solid-js';
import type { TestLoad } from './report-context';
import { useReport } from './report-context';
import { TestInspection } from './test-inspection';
import { TestNav } from './test-nav';
import type { ReportNav } from './use-report-nav';

/** Opens the timeline at once. Frame files stream into the phones as they arrive. */
export function TestView(props: { nav: ReportNav }) {
  const { t } = useLingui();
  const report = useReport();
  const testId = createMemo(() => {
    const r = props.nav.route();
    return r.view === 'test' ? r.testId : '';
  });
  createEffect(() => {
    const id = testId();
    if (id !== '') report.loader?.load(id);
  });
  const load = createMemo(
    (): TestLoad => report.loader?.state(testId()) ?? { kind: 'ready' }
  );
  const known = createMemo(
    () =>
      report.data.tests.find((t) => t.report.meta.testId === testId()) ?? null
  );
  const failure = createMemo(() => {
    const l = load();
    return l.kind === 'error' ? l.message : null;
  });
  return (
    <Switch fallback={<Notice>{t`Waiting for ${testId()}…`}</Notice>}>
      <Match when={known()}>
        <LoadedTestView nav={props.nav} testId={testId()} />
      </Match>
      <Match when={load().kind === 'missing'}>
        <Notice>{t`Unknown test: ${testId()}`}</Notice>
      </Match>
      <Match when={failure()}>
        {(message) => (
          <Notice tone="error">{t`Could not load ${testId()}: ${message()}`}</Notice>
        )}
      </Match>
    </Switch>
  );
}

function LoadedTestView(props: { nav: ReportNav; testId: string }) {
  const { t } = useLingui();
  const report = useReport();
  const testId = () => props.testId;
  const test = createMemo(
    () =>
      report.data.tests.find((t) => t.report.meta.testId === testId()) ?? null
  );
  const frames = createMemo(() => {
    const t = test();
    return t ? testFrames(t) : [];
  });
  const sel = createMemo(() => selectedFrame(frames(), props.nav.route()));
  createEffect(() => {
    const selected = sel();
    const ensure = report.loader?.ensureBlob;
    if (!selected || !ensure) return;
    for (const file of frameFilesNear(frames(), selected.index, 8)) {
      ensure(testId(), file);
    }
  });

  return (
    <Show
      when={test()}
      fallback={<Notice>{t`Unknown test: ${testId()}`}</Notice>}
    >
      {(test) => (
        <div class="sr-test box flex-1 min-h-0 min-w-0 gap-3">
          <TestNav nav={props.nav} testId={testId()} />
          <TestInspection
            test={test()}
            frames={frames()}
            selected={sel()}
            nav={props.nav}
          />
        </div>
      )}
    </Show>
  );
}
