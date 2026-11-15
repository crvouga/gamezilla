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
import {
  CatalogueLoadResultView,
  useCatalogueFormat,
} from './catalogue-load-result-view';
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
  /** Checks again whether the file is saved. */
  readonly onRecheck: () => void;
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
  /** The last check failed, so whether a file is saved is not known. */
  checkFailed: boolean;
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
          <Show
            when={props.checkFailed}
            fallback={
              <Trans>Save a {props.sourceName} before loading puzzles.</Trans>
            }
          >
            <Trans>Could not check for a saved {props.sourceName}.</Trans>
          </Show>
        </P>
      </Match>
    </Switch>
  );
}

/** The hub's one command: start a load, or stop the one running. */
function HubCommand(props: {
  command: CatalogueLoadCommand;
  sourceName: string;
  checkFailed: boolean;
  /** The latest load failed: starting again is its retry. */
  lastFailed: boolean;
  /** A load ran before: starting is loading again. */
  loadedBefore: boolean;
  onOpenSource: () => void;
  onRecheck: () => void;
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
      get idle() {
        return props.loadedBefore ? t`Load again` : t`Start loading`;
      },
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
      <Show when={blocked()} keyed>
        {(reason) => (
          <StartBlock
            blocked={reason}
            sourceName={props.sourceName}
            checkFailed={props.checkFailed}
          />
        )}
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
        <Show when={props.command.kind === 'start' && props.lastFailed}>
          <Button
            title={t`Replace the file`}
            intent="neutral"
            variant="outline"
            onClick={() => props.onOpenSource()}
            dataSet={{ testid: 'puzzle-load-replace' }}
          />
        </Show>
        <Show when={props.checkFailed}>
          <Button
            title={t`Check again`}
            intent="neutral"
            variant="outline"
            onClick={() => props.onRecheck()}
            dataSet={{ testid: 'puzzle-load-recheck' }}
          />
        </Show>
      </StackHorizontal>
    </>
  );
}

/**
 * The loader's hub. With a latest load: how it stands and how far it is,
 * then the one command (start, or stop the load running), the pool and
 * the shared file (a row that opens its own place), then the load's
 * figures. Before any load: the pool and the file, then the command.
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
  const format = useCatalogueFormat();
  const rows = (): JSX.Element => (
    <MenuSection>
      <MenuRow
        title={<Trans>Available puzzles</Trans>}
        value={props.pool === null ? '—' : format.count(props.pool)}
        dataSet={{ testid: 'puzzle-load-pool' }}
      />
      <MenuRow
        title={props.copy.sourceName}
        caption={<SourceValue source={props.source} />}
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
  );
  const commandView = (): JSX.Element => (
    <HubCommand
      command={command()}
      sourceName={props.copy.sourceName}
      checkFailed={props.source.status === 'check-failed'}
      lastFailed={props.job?.status === 'failed'}
      loadedBefore={props.job !== null && props.job.status !== 'adding'}
      onOpenSource={props.onOpenSource}
      onRecheck={props.onRecheck}
      onStart={props.onStart}
      onAskStop={props.onAskStop}
    />
  );
  return (
    <StackVertical gap="lg" testId="puzzle-load-hub">
      <Show
        when={props.job}
        fallback={
          <>
            {rows()}
            {commandView()}
          </>
        }
      >
        {(job) => (
          <CatalogueLoadResultView job={job()}>
            {commandView()}
            {rows()}
          </CatalogueLoadResultView>
        )}
      </Show>
    </StackVertical>
  );
}
