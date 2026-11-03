/**
 * Story-only stand-ins for the smart widgets the content screen views take
 * as slots: a tiny counting game's player and editor (the harness's example
 * content game), and the buttons each smart control shows at rest.
 */
import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { type JSX, Show } from 'solid-js';

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
  return <Button title="Start playtest" disabled={props.disabled} />;
}

/** Earlier kept copies of a draft. */
export function StoryKeptCopies(): JSX.Element {
  return (
    <MenuSection title="Kept copies">
      <MenuRow title="Count to seven" value="Current" />
      <MenuRow title="Count to five" caption="Kept earlier" />
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
