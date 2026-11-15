import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { FilePicker } from '@pkgs/ui-root-client-ts/file-picker';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createEffect, type JSX, on, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type {
  CatalogueLoadCopy,
  CatalogueSourceUpload,
} from './catalogue-load-client';
import type { CatalogueLoadLink } from './catalogue-load-places';
import type { CatalogueSourceView } from './catalogue-load-view';

export type CatalogueLoadSourceViewProps = {
  readonly copy: CatalogueLoadCopy;
  readonly link: CatalogueLoadLink;
  readonly source: CatalogueSourceView;
  readonly onSelectFile: (file: File | null) => void;
  readonly onSave: () => Promise<void>;
  readonly onRecheck: () => void;
  readonly onAskStop: () => void;
  /** Returns to the loader's hub, where loading starts. */
  readonly onDone: () => void;
};

/** The upload under way: how far it is, and the one way to stop it. */
function SourceUpload(props: {
  upload: CatalogueSourceUpload;
  sourceName: string;
  onAskStop: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <StackVertical role="status" testId="puzzle-source-saving">
        <ProgressBar
          label={t`Uploading ${props.sourceName}`}
          progress={props.upload.progress}
          dataSet={{ testid: 'puzzle-source-progress' }}
          description={
            <Trans>
              Uploaded {props.upload.puzzles} puzzles to the shared bucket. Keep
              this screen open until the upload finishes.
            </Trans>
          }
        />
      </StackVertical>
      <StackHorizontal wrap gap="md">
        <Button
          title={t`Stop saving file`}
          intent="danger"
          variant="outline"
          onClick={() => props.onAskStop()}
          dataSet={{ testid: 'puzzle-load-stop' }}
        />
      </StackHorizontal>
    </>
  );
}

/** No file is saved: choose one and upload it. */
function SourceChoice(props: CatalogueLoadSourceViewProps): JSX.Element {
  const { t } = useLingui();
  const save = useMutationButton({
    operation: () => props.onSave(),
    get disabled() {
      return props.source.status !== 'chosen' || props.link === 'offline';
    },
    labels: {
      idle: t`Upload ${props.copy.sourceName}`,
      loading: t`Uploading ${props.copy.sourceName}…`,
      success: t`${props.copy.sourceName} uploaded`,
      error: t`Try uploading again`,
    },
  });
  // Another file is another attempt: the button forgets the last outcome.
  createEffect(
    on(
      () => props.source.chosen,
      () => save.reset(),
      { defer: true }
    )
  );
  return (
    <>
      {/* Once the upload is done the place moves on to the saved file. */}
      <Show when={save.feedback() !== 'success'}>
        <Notice dataSet={{ testid: 'puzzle-source-missing' }}>
          <Trans>
            No {props.copy.sourceName} is saved yet. Choose one and upload it,
            then start loading its puzzles.
          </Trans>
        </Notice>
      </Show>
      <FilePicker
        label={<Dynamic component={props.copy.fileLabel} />}
        accept={props.copy.fileAccept}
        chooseLabel={t`Choose file`}
        emptyLabel={t`No file chosen`}
        fileName={props.source.chosen}
        hint={<Dynamic component={props.copy.fileHint} />}
        onSelect={(file) => props.onSelectFile(file)}
        dataSet={{ testid: 'puzzle-load-file' }}
        fileDataSet={{ testid: 'puzzle-source-chosen' }}
      />
      <Button
        {...save.buttonProps}
        fullWidth
        dataSet={{ testid: 'puzzle-source-save' }}
      />
    </>
  );
}

/** No file is saved: the place asks for one, and its picker names the choice. */
function choosingFile(source: CatalogueSourceView): boolean {
  return source.status === 'missing' || source.status === 'chosen';
}

/**
 * The saved file, by name; a chosen one too while the picker is not shown
 * (it is uploading, or being checked for).
 */
function SourceFiles(props: {
  source: CatalogueSourceView;
  sourceName: string;
}): JSX.Element {
  return (
    <Show
      when={
        props.source.filename !== null ||
        (!choosingFile(props.source) && props.source.chosen !== null)
      }
    >
      <MenuSection>
        <Show when={props.source.filename} keyed>
          {(filename) => (
            <MenuRow
              title={<Trans>Saved {props.sourceName}</Trans>}
              caption={filename}
              dataSet={{ testid: 'puzzle-source-saved' }}
            />
          )}
        </Show>
        <Show
          when={
            props.source.filename === null &&
            !choosingFile(props.source) &&
            props.source.chosen
          }
          keyed
        >
          {(chosen) => (
            <MenuRow
              title={<Trans>Chosen {props.sourceName}</Trans>}
              caption={chosen}
              dataSet={{ testid: 'puzzle-source-chosen' }}
            />
          )}
        </Show>
      </MenuSection>
    </Show>
  );
}

/** What the last check says, before anything can be done about the file. */
function SourceCheck(props: CatalogueLoadSourceViewProps): JSX.Element {
  return (
    <>
      <Show
        when={props.source.status === 'unknown' && props.link === 'offline'}
      >
        <Notice dataSet={{ testid: 'puzzle-source-check-offline' }}>
          <Trans>
            A connection is needed to check for the saved{' '}
            {props.copy.sourceName}.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.source.status === 'checking'}>
        <LoadingState
          dataSet={{ testid: 'puzzle-source-checking' }}
          variant="compact"
          caption={
            <Trans>Checking for the saved {props.copy.sourceName}…</Trans>
          }
        />
      </Show>
      <Show when={props.source.checkError} keyed>
        {(error) => (
          <Notice tone="error" dataSet={{ testid: 'puzzle-source-error' }}>
            {error}
          </Notice>
        )}
      </Show>
    </>
  );
}

/**
 * The shared source file's own place: what the last check found, the saved
 * or chosen file, choosing and uploading one when none is saved, checking
 * again, and the upload under way with its stop.
 */
export function CatalogueLoadSourceView(
  props: CatalogueLoadSourceViewProps
): JSX.Element {
  const { t } = useLingui();
  const status = () => props.source.status;
  const choosing = () => choosingFile(props.source);
  const recheckOffered = () =>
    status() === 'check-failed' || status() === 'saved' || choosing();
  return (
    <StackVertical gap="lg" testId="puzzle-source-place">
      <SourceCheck {...props} />
      <SourceFiles source={props.source} sourceName={props.copy.sourceName} />
      <Show when={status() === 'saved'}>
        <Notice tone="success" dataSet={{ testid: 'puzzle-source-ready' }}>
          <Show
            when={props.link === 'offline'}
            fallback={
              <Trans>
                The {props.copy.sourceName} is saved. Go back to start loading
                its puzzles.
              </Trans>
            }
          >
            <Trans>
              The {props.copy.sourceName} is saved. Loading its puzzles can
              start once you are back online.
            </Trans>
          </Show>
        </Notice>
        <Button
          title={t`Back to loading`}
          intent="primary"
          variant="solid"
          fullWidth
          onClick={() => props.onDone()}
          dataSet={{ testid: 'puzzle-source-done' }}
        />
      </Show>
      <Show when={props.source.saveError} keyed>
        {(error) => (
          <Notice tone="error" dataSet={{ testid: 'puzzle-source-save-error' }}>
            {error}
          </Notice>
        )}
      </Show>
      <Show when={choosing()}>
        <SourceChoice {...props} />
      </Show>
      <Show when={props.source.upload}>
        {(upload) => (
          <SourceUpload
            upload={upload()}
            sourceName={props.copy.sourceName}
            onAskStop={props.onAskStop}
          />
        )}
      </Show>
      <Show when={recheckOffered()}>
        <StackHorizontal wrap gap="md">
          <Button
            dataSet={{ testid: 'puzzle-source-recheck' }}
            title={t`Check for a saved file again`}
            intent="neutral"
            variant="outline"
            disabled={props.link === 'offline'}
            onClick={() => props.onRecheck()}
          />
        </StackHorizontal>
      </Show>
    </StackVertical>
  );
}
