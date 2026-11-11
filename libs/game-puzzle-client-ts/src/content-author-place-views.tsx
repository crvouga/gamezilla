import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import type { ContentAuthorScreenViewProps } from './content-author-screen-view';
import { ContentDraftMetadata } from './content-draft-metadata';

type View = ContentAuthorScreenViewProps;

/**
 * `details`: the draft's title, description and difficulty. Every change
 * is saved as it is typed (the shell's save line says so); Done returns to
 * the steps.
 */
export function ContentAuthorDetailsView(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="lg" dataSet={{ testid: 'content-author-details' }}>
      <ContentDraftMetadata
        body={props.view.body}
        disabled={props.view.metadataDisabled}
        onChange={props.view.onChangeBody}
      />
      <Button
        title={t`Done`}
        intent="primary"
        variant="solid"
        fullWidth
        onClick={() => props.view.onOpen({ screen: 'builder' })}
        dataSet={{ testid: 'content-details-done' }}
      />
    </StackVertical>
  );
}

/**
 * `board`: the game's own editor (a pack: its puzzles), headed by what it
 * is and undo and redo of this session's edits.
 */
export function ContentAuthorBoardView(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="md" dataSet={{ testid: 'content-author-stage' }}>
      <StackHorizontal
        gap="sm"
        wrap
        align="center"
        justify="between"
        dataSet={{ testid: 'content-author-tools' }}
      >
        <H2 size="navigationTitle" testId="content-author-stage-step">
          {props.view.kind === 'pack' ? t`Puzzles` : t`Board`}
        </H2>
        <StackHorizontal gap="xs" wrap align="center">
          {props.view.history}
        </StackHorizontal>
      </StackHorizontal>
      {props.view.stage}
    </StackVertical>
  );
}

/** `preview`: the draft as a solver sees it; nothing here changes it. */
export function ContentAuthorPreviewView(props: { view: View }): JSX.Element {
  return (
    <StackVertical gap="md" dataSet={{ testid: 'content-author-preview' }}>
      {props.view.preview}
    </StackVertical>
  );
}

/**
 * `publish`: the one next action over the steps to publish (a puzzle's
 * playtest first among them), what the last check found, and viewing or
 * withdrawing what is published.
 */
export function ContentAuthorPublishView(props: { view: View }): JSX.Element {
  return (
    <StackVertical gap="md" dataSet={{ testid: 'content-author-publish' }}>
      {props.view.publication}
    </StackVertical>
  );
}

/** `copies`: the draft's kept copies; choosing one continues from it. */
export function ContentAuthorCopiesView(props: { view: View }): JSX.Element {
  return (
    <StackVertical gap="md" dataSet={{ testid: 'content-author-copies' }}>
      {props.view.keptCopies}
    </StackVertical>
  );
}
