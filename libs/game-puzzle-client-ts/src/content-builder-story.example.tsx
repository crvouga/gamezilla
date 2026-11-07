/**
 * Story-only: a game's puzzle editor where an author meets it, the stage
 * of the shared puzzle builder (`ContentAuthorScreenView`), after the
 * puzzle's details, before its draft copies, over its publish bar.
 * Production never imports this module.
 */
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { ContentAuthorScreenView } from './content-author-screen-view';
import { ContentPublicationControlsView } from './content-publication-controls-view';
import {
  StoryDraftHistory,
  StoryKeptCopies,
  StoryPlaytest,
} from './content-story.example';

export function StoryPuzzleBuilder(props: {
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
  /** The title an earlier saved copy of the draft had. */
  readonly earlier: string;
  /** The builder is saving: nothing in it can be used. */
  readonly disabled: boolean;
  /** The game's own editor. */
  readonly stage: JSX.Element;
}): JSX.Element {
  return (
    <ContentAuthorScreenView
      status="ready"
      documentId="5d0c1a00-0000-4000-8000-0000000000b1"
      kind="puzzle"
      body={{
        title: props.title,
        description: props.description,
        difficulty: props.difficulty,
        definition: props.definition,
      }}
      save={{ saving: props.disabled, dirty: props.disabled, error: null }}
      conflicted={false}
      metadataDisabled={props.disabled}
      disabled={props.disabled}
      preview={false}
      history={<StoryDraftHistory disabled={props.disabled} />}
      publication={
        <ContentPublicationControlsView
          copyState={{ kind: 'draft' }}
          layout="bar"
          before={(next) => (
            <StoryPlaytest disabled={props.disabled} next={next()} />
          )}
          kind="puzzle"
          validation="unchecked"
          validationMessage=""
          proven={false}
          pending={null}
          published={false}
          disabled={props.disabled}
          onValidate={fn(async () => undefined)}
          onPublish={fn(async () => undefined)}
          onViewPublication={fn()}
          onWithdraw={fn(async () => undefined)}
        />
      }
      stage={props.stage}
      keptCopies={
        <StoryKeptCopies current={props.title} earlier={props.earlier} />
      }
      onChangeBody={fn()}
      onSaveAgain={fn()}
      onTogglePreview={fn()}
      onReturnToLibrary={fn()}
    />
  );
}
