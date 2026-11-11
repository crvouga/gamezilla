import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createMemo, type JSX, Match, Show, Switch } from 'solid-js';
import type {
  CatalogueLoadCopy,
  CatalogueLoadJob,
} from './catalogue-load-client';
import {
  type CatalogueLoadCommand,
  type CatalogueLoadLink,
  type CatalogueLoadStage,
  type CatalogueStartBlock,
  catalogueLoadCommand,
} from './catalogue-load-places';
import { CatalogueLoadResultView } from './catalogue-load-result-view';
import type { CatalogueSourceView } from './catalogue-load-view';

export type CatalogueLoadHubViewProps = {
  readonly copy: CatalogueLoadCopy;
  readonly stage: CatalogueLoadStage;
  readonly link: CatalogueLoadLink;
  /** The puzzles available to solvers; `null` until a load reported it. */
  readonly pool: number | null;
  /** The latest load; `null` when none has run or is known. */
  readonly job: CatalogueLoadJob | null;
  readonly source: CatalogueSourceView;
  readonly onOpenSource: () => void;
  readonly onStart: () => Promise<void>;
  readonly onAskStop: () => void;
};

/** Where the shared file stands, as the value of the row that opens it. */
function SourceValue(props: { source: CatalogueSourceView }): JSX.Element {
  return (
    <Switch fallback={<Trans>Not checked</Trans>}>
      <Match when={props.source.status === 'checking'}>
        <Trans>Checking…</Trans>
      </Match>
      <Match when={props.source.status === 'check-failed'}>
        <Trans>Could not check</Trans>
      </Match>
      <Match when={props.source.status === 'saved'}>
        {props.source.filename}
      </Match>
      <Match when={props.source.status === 'missing'}>
        <Trans>None saved</Trans>
      </Match>
      <Match when={props.source.status === 'chosen'}>
        <Trans>Not saved yet</Trans>
      </Match>
      <Match when={props.source.status === 'uploading'}>
        <Trans>Saving…</Trans>
      </Match>
    </Switch>
  );
}

/** Why loading cannot start now, under the command it explains. */
function StartBlock(props: {
  blocked: CatalogueStartBlock;
  sourceName: string;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.blocked === 'connecting'}>
        <LoadingState
          variant="compact"
          caption={<Trans>Connecting to puzzle status…</Trans>}
        />
      </Match>
      <Match when={props.blocked === 'checking'}>
        <P
          variant="caption"
          tone="secondary"
          dataSet={{ testid: 'puzzle-load-blocked', reason: props.blocked }}
        >
          <Trans>Checking for the saved {props.sourceName} first.</Trans>
        </P>
      </Match>
      <Match when={props.blocked === 'no-source'}>
        <P
          variant="caption"
          tone="secondary"
          dataSet={{ testid: 'puzzle-load-blocked', reason: props.blocked }}
        >
          <Trans>Save a {props.sourceName} before loading puzzles.</Trans>
        </P>
      </Match>
    </Switch>
  );
}

/** The hub's one command: start a load, or stop the one running. */
function HubCommand(props: {
  command: CatalogueLoadCommand;
  sourceName: string;
  onStart: () => Promise<void>;
  onAskStop: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const start = useMutationButton({
    operation: () => props.onStart(),
    get disabled() {
      return props.command.kind !== 'start' || props.command.blocked !== null;
    },
    labels: {
      idle: t`Start loading`,
      loading: t`Starting load…`,
      success: t`Load started`,
      error: t`Try loading again`,
    },
  });
  const blocked = (): CatalogueStartBlock | null =>
    props.command.kind === 'start' ? props.command.blocked : null;
  return (
    <>
      <Show when={start.error()} keyed>
        {(error) => <Notice tone="error">{error.message}</Notice>}
      </Show>
      <StackHorizontal wrap gap="md">
        <Show
          when={props.command.kind === 'stop'}
          fallback={
            <Button
              {...start.buttonProps}
              dataSet={{ testid: 'puzzle-load-start' }}
            />
          }
        >
          <Button
            title={t`Stop loading`}
            disabled={props.command.blocked !== null}
            intent="danger"
            variant="outline"
            onClick={() => props.onAskStop()}
            dataSet={{ testid: 'puzzle-load-stop' }}
          />
        </Show>
      </StackHorizontal>
      <Show when={blocked()} keyed>
        {(reason) => (
          <StartBlock blocked={reason} sourceName={props.sourceName} />
        )}
      </Show>
    </>
  );
}

/**
 * The loader's hub: the pool, the shared file (a row that opens its own
 * place), the one command and the latest load.
 */
export function CatalogueLoadHubView(
  props: CatalogueLoadHubViewProps
): JSX.Element {
  const command = createMemo(() =>
    catalogueLoadCommand({
      stage: props.stage,
      link: props.link,
      source: props.source.status,
      saved: props.source.filename !== null,
    })
  );
  return (
    <StackVertical gap="lg" testId="puzzle-load-hub">
      <MenuSection>
        <MenuRow
          title={<Trans>Available puzzles</Trans>}
          value={props.pool ?? '—'}
          dataSet={{ testid: 'puzzle-load-pool' }}
        />
        <MenuRow
          title={props.copy.sourceName}
          value={<SourceValue source={props.source} />}
          trailing={
            props.source.status === 'checking' ? (
              <Spinner size="sm" decorative />
            ) : undefined
          }
          onClick={() => props.onOpenSource()}
          dataSet={{
            testid: 'puzzle-load-source',
            status: props.source.status,
          }}
        />
      </MenuSection>
      <HubCommand
        command={command()}
        sourceName={props.copy.sourceName}
        onStart={props.onStart}
        onAskStop={props.onAskStop}
      />
      <Show when={props.stage === 'loading'}>
        <Notice>
          <Trans>
            Loading continues in the background. The saved file stays available.
            You can return here to follow its progress or stop it.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.job}>
        {(job) => <CatalogueLoadResultView job={job()} />}
      </Show>
    </StackVertical>
  );
}
