import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { type JSX, Match, Switch } from 'solid-js';
import type { ExportDownloadState } from './privacy-export-state';

function ExportReady(props: {
  readonly summary: string;
  readonly detail: string;
}): JSX.Element {
  return (
    <StackVertical gap="sm" testId="privacy-export-ready">
      <P>
        <Trans>
          Your export is ready. Downloads are private to your recently proven
          account and expire 7 days after becoming ready.
        </Trans>
      </P>
      <TextLink
        variant="standalone"
        testId="privacy-export-summary"
        download="personal-data-summary.txt"
        href={`data:text/plain;charset=utf-8,${encodeURIComponent(props.summary)}`}
      >
        <Trans>Download readable summary</Trans>
      </TextLink>
      <TextLink
        variant="standalone"
        testId="privacy-export-detail"
        download="personal-data.json"
        href={`data:application/json;charset=utf-8,${encodeURIComponent(props.detail)}`}
      >
        <Trans>Download reusable detail</Trans>
      </TextLink>
    </StackVertical>
  );
}

/** The export's download area: its links, or why there are none. */
export function ExportDownload(props: {
  readonly state: ExportDownloadState;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.state.kind === 'ownerDenied'}>
        <Notice
          tone="warning"
          dataSet={{ testid: 'privacy-export-owner-denial' }}
        >
          <Trans>
            This export belongs to another account and cannot be downloaded.
          </Trans>
        </Notice>
      </Match>
      <Match when={props.state.kind === 'expired'}>
        <P tone="secondary" testId="privacy-export-expired">
          <Trans>The export has expired. Ask for a new one.</Trans>
        </P>
      </Match>
      <Match
        when={props.state.kind === 'denied' ? props.state.denial : undefined}
      >
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Match>
      <Match when={props.state.kind === 'ready' ? props.state : undefined}>
        {(ready) => (
          <ExportReady summary={ready().summary} detail={ready().detail} />
        )}
      </Match>
    </Switch>
  );
}
