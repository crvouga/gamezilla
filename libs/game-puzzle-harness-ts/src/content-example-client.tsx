import { ContentExperience } from '@libs/game-puzzle-client-ts/content-experience';
import type {
  PuzzleContentClient,
  PuzzleEditorProps,
  PuzzlePlayerProps,
} from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { SpacesNavProvider } from '@libs/spaces-client-ts/spaces-nav-context';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import type { JSX } from 'solid-js';
import { examplePuzzleContent } from './example-app-rules';

function CountingEditor(props: PuzzleEditorProps): JSX.Element {
  return (
    <TextInput
      label="Target"
      value={props.definition.slice(7)}
      maxLength={1}
      disabled={props.disabled}
      onChangeText={(value) => props.onChange(`target:${value}`)}
    />
  );
}

function CountingPlayer(props: PuzzlePlayerProps): JSX.Element {
  const canStep = (action: string): boolean =>
    examplePuzzleContent.rules.apply(props.definition, props.state, action)
      .accepted;
  return (
    <StackVertical gap="md">
      <P role="status">{props.state}</P>
      <Button
        title="Take one step"
        disabled={props.disabled || !canStep('step1')}
        onClick={() => props.onAction('step1')}
        dataSet={{ testid: 'counting-step-one' }}
      />
      <Button
        title="Take two steps"
        disabled={props.disabled || !canStep('step2')}
        onClick={() => props.onAction('step2')}
        dataSet={{ testid: 'counting-step-two' }}
      />
    </StackVertical>
  );
}

export const countingContentClient: PuzzleContentClient = {
  Player: CountingPlayer,
  frame: { stats: { remaining: () => 'Steps left' }, turnStatus: () => null },
  authoring: { initialDefinition: () => 'target:', Editor: CountingEditor },
};

/** The shared content experience of one harness game, as the app offers it. */
export function ContentExampleClient(props: {
  gameId: string;
  title: string;
  content: PuzzleContent;
  client: PuzzleContentClient;
}): JSX.Element {
  return (
    <SpacesNavProvider>
      <ContentExperience
        gameId={props.gameId}
        title={props.title}
        content={props.content}
        client={props.client}
        onBack={() => {
          throw new Error('This fixture opens the puzzle library directly');
        }}
      />
    </SpacesNavProvider>
  );
}
