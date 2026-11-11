/**
 * Story-only: a game's puzzle editor where an author meets it, the board
 * screen of the shared puzzle builder (`ContentAuthorScreenView`), under
 * the draft's title and save line, headed by undo and redo. Production
 * never imports this module.
 */
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { ContentAuthorScreenView } from './content-author-screen-view';
import { StoryDraftHistory } from './content-story.example';

export function StoryPuzzleBuilder(props: {
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
  /** The builder is saving: nothing in it can be used. */
  readonly disabled: boolean;
  /**
   * This session has edits to undo, as the production builder's history
   * says; a draft just opened has none.
   */
  readonly undoable?: boolean | undefined;
  /** The game's own editor. */
  readonly stage: JSX.Element;
}): JSX.Element {
  return (
    <ContentAuthorScreenView
      status="ready"
      documentId="5d0c1a00-0000-4000-8000-0000000000b1"
      draftId="5d0c1a00-0000-4000-8000-0000000000b2"
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
      place={{ screen: 'board' }}
      onOpen={fn()}
      standing={{ kind: 'playtest' }}
      history={
        <StoryDraftHistory
          disabled={props.disabled || props.undoable === false}
        />
      }
      stage={props.stage}
      onChangeBody={fn()}
      onSaveAgain={fn()}
      onReturnToLibrary={fn()}
    />
  );
}
