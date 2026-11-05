/**
 * Story-only stand-ins for the smart widgets the content screen views take
 * as slots: a tiny counting game's player and editor (the harness's example
 * content game), and the buttons each smart control shows at rest.
 */
import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { PlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { For, type JSX, Show } from 'solid-js';
import {
  ContentPackEditorView,
  ContentPackItemRow,
} from './content-pack-editor-view';

/** A counting puzzle's draft body: reach the target in steps of one or two. */
export const COUNTING_BODY: ContentBody = {
  title: 'Count to seven',
  description: 'Reach seven exactly, one or two steps at a time.',
  difficulty: 'Easy',
  definition: 'target:7',
};

/** The counting game's player on a saved state. */
export function StoryCountingPlayer(props: {
  state: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <StackVertical gap="md">
      <P role="status">{props.state}</P>
      <Button title="Take one step" disabled={props.disabled} />
      <Button title="Take two steps" disabled={props.disabled} />
    </StackVertical>
  );
}

/** The counting game's editor for its target. */
export function StoryCountingEditor(props: {
  target: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <TextInput
      label="Target"
      value={props.target}
      maxLength={1}
      disabled={props.disabled}
      onChangeText={() => undefined}
    />
  );
}

/** Undo / redo of the session's draft edits, at rest. */
export function StoryDraftHistory(props: { disabled?: boolean }): JSX.Element {
  return (
    <>
      <Button
        title="Undo edit"
        intent="neutral"
        variant="outline"
        disabled={props.disabled}
      />
      <Button title="Redo edit" intent="neutral" variant="outline" disabled />
    </>
  );
}

/** Starting a private playtest, at rest. */
export function StoryPlaytest(props: { disabled?: boolean }): JSX.Element {
  return (
    <Button
      title="Start playtest"
      intent="neutral"
      variant="outline"
      disabled={props.disabled}
    />
  );
}

/** The draft's other saved copies, the one being edited first. */
export function StoryKeptCopies(props: {
  current?: string;
  earlier?: string;
}): JSX.Element {
  return (
    <MenuSection
      title="Draft copies"
      footer="Each save keeps a copy of this draft. Choose one to keep working from it; the others stay saved, and published editions do not change."
    >
      <MenuRow
        title={props.current ?? 'Count to seven'}
        caption="Saved draft copy"
        value="Editing now"
        selected
        disabled
      />
      <MenuRow
        title={props.earlier ?? 'Count to five'}
        caption="Saved draft copy"
        value="Use copy"
        onClick={() => undefined}
      />
    </MenuSection>
  );
}

/** Start or continue an attempt at a published puzzle, at rest. */
export function StoryStartAttempt(props: {
  continuing?: boolean;
  disabled?: boolean;
}): JSX.Element {
  return (
    <StackVertical gap="md">
      <Show when={props.continuing}>
        <Button title="Continue saved attempt" />
      </Show>
      <Button title="Start a new attempt" disabled={props.disabled} />
    </StackVertical>
  );
}

/** A pack's puzzles and the person's progress through them. */
export function StoryPackOverview(): JSX.Element {
  return (
    <StackVertical gap="lg">
      <P role="status">1 of 3 puzzles completed</P>
      <Button title="Continue Count to seven" />
      <MenuSection title="Choose any puzzle">
        <MenuRow title="Count to five" value="Completed" />
        <MenuRow title="Count to seven" value="In progress" />
        <MenuRow title="Count to nine" value="Unplayed" />
      </MenuSection>
    </StackVertical>
  );
}

/** The puzzles a pack builder story's pack holds, in order. */
const PACK_PUZZLES = [
  {
    id: 'puzzle-count-to-five',
    title: 'Count to five',
    caption: 'Published',
  },
  {
    id: 'puzzle-count-to-seven',
    title: 'Count to seven',
    caption: 'Published',
  },
  {
    id: 'puzzle-count-to-nine',
    title: 'Count to nine',
    caption: 'Draft: publish it before the pack',
  },
] as const;

/**
 * The pack builder's stage on the real view: the pack's puzzles with their
 * tools, published puzzles to add, and a new puzzle to create in it.
 */
export function StoryPackEditor(props: { disabled?: boolean }): JSX.Element {
  return (
    <ContentPackEditorView
      readable
      count={PACK_PUZZLES.length}
      order={
        <For each={PACK_PUZZLES}>
          {(puzzle, index) => (
            <ContentPackItemRow
              {...puzzle}
              first={index() === 0}
              last={index() === PACK_PUZZLES.length - 1}
              disabled={props.disabled === true}
              open="edit"
              onOpen={() => undefined}
              onUp={() => undefined}
              onDown={() => undefined}
              onRemove={() => undefined}
            />
          )}
        </For>
      }
      candidates={[
        {
          id: 'revision-thirteen',
          title: 'Thirteen without overshooting',
          caption: 'Medium',
        },
      ]}
      addDisabled={props.disabled === true}
      onAdd={() => undefined}
      create={
        <StackVertical align="start">
          <Button
            title="Create puzzle in this pack"
            intent="neutral"
            variant="outline"
            startIcon={<PlusIcon size={20} />}
            disabled={props.disabled}
          />
        </StackVertical>
      }
    />
  );
}

/** An attempt's undo, redo and restart, at rest. */
export function StoryAttemptControls(props: {
  disabled?: boolean;
}): JSX.Element {
  return (
    <StackHorizontal gap="sm" wrap>
      <Button
        title="Undo"
        intent="neutral"
        variant="outline"
        disabled={props.disabled}
      />
      <Button title="Redo" intent="neutral" variant="outline" disabled />
      <Button
        title="Restart"
        intent="neutral"
        variant="outline"
        disabled={props.disabled}
      />
    </StackHorizontal>
  );
}
