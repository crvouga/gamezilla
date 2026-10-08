import { useLingui } from '@lingui/solid/macro';
import type { SpecEntry } from '@pkgs/harness-report-shared/explorer-types';
import { testsForSpec } from '@pkgs/harness-report-shared/spec-evidence';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { DocumentPanel } from '@pkgs/ui-root-client/document-panel';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { Notice } from '@pkgs/ui-root-client/notice';
import { createMemo, createResource, For, Show } from 'solid-js';
import type { ExplorerResource } from './explorer-resource';
import { ReportStatus } from './report-status';
import { SpecReportParts } from './spec-report-parts';

export function SpecDetail(props: {
  readonly entry: SpecEntry;
  readonly resource: ExplorerResource;
  readonly tests: readonly HtmlReportTest[];
  readonly onOpen: (id: string) => void;
  readonly onOpenPart: (kind: string, path: string) => void;
}) {
  const { t } = useLingui();
  const [document] = createResource(
    () => props.entry.path,
    (path) => props.resource.readSpec(path)
  );
  const tests = createMemo(() => testsForSpec(props.entry, props.tests));
  return (
    <div class="box gap-6" data-testid="report-spec-detail">
      <SpecReportParts
        entry={props.entry}
        parts={props.resource.data()?.parts ?? []}
        onOpen={props.onOpenPart}
      />
      <Show when={document.error}>
        <Notice tone="error">{t`This spec could not be loaded. Refresh to try again.`}</Notice>
      </Show>
      <Show
        when={!document.loading && !document.error}
        fallback={<LoadingState variant="compact" caption={t`Loading spec…`} />}
      >
        <Show
          when={document() != null}
          fallback={
            <EmptyState
              variant="compact"
              title={t`Spec unavailable`}
              body={t`The selected version has no readable copy of this spec.`}
            />
          }
        >
          <DocumentPanel
            title={props.entry.title}
            caption={props.entry.path}
            content={document() ?? ''}
          />
        </Show>
      </Show>
      <Show
        when={tests().length > 0}
        fallback={
          <Notice>{t`No completed test report is recorded for this spec. Missing evidence is not a passing result.`}</Notice>
        }
      >
        <MenuSection
          title={t`Recorded test reports`}
          footer={t`These are recorded outcomes. Full verification decides whether every obligation is satisfied.`}
        >
          <For each={tests()}>
            {(test) => (
              <MenuRow
                title={test.report.meta.title}
                caption={test.report.meta.error}
                trailing={<ReportStatus status={test.report.meta.status} />}
                onClick={() => props.onOpen(test.report.meta.testId)}
              />
            )}
          </For>
        </MenuSection>
      </Show>
    </div>
  );
}
