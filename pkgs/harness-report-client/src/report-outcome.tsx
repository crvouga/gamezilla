import { useLingui } from '@lingui/solid/macro';
import { Notice } from '@pkgs/ui-root-client/notice';
import { TextLink } from '@pkgs/ui-root-client/text-link';
import { Show } from 'solid-js';
import type { RemoteReportPhase } from './remote-report';
import { ReportStatus } from './report-status';

export function ReportOutcome(props: {
  readonly phase?: RemoteReportPhase | undefined;
  readonly status: string;
  readonly hasFailingTests: boolean;
  readonly runUrl?: string | null | undefined;
}) {
  const { t } = useLingui();
  return (
    <Show when={props.phase === 'complete' || props.phase === undefined}>
      <div class="box gap-3">
        <div class="box flex-row flex-wrap items-center gap-3">
          <p class="text textCaption">{t`Recorded run`}</p>
          <ReportStatus status={props.status} />
          <Show when={props.runUrl}>
            {(url) => (
              <TextLink href={url()}>{t`Open verification details`}</TextLink>
            )}
          </Show>
        </div>
        <Show when={props.status === 'failed' && !props.hasFailingTests}>
          <Notice tone="error">{t`The run failed beyond its individual recorded test outcomes. Passing individual checks do not mean the run completed successfully. The verification details contain the remaining failures.`}</Notice>
        </Show>
      </div>
    </Show>
  );
}
