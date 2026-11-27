import type { JSX } from '@solidjs/web';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import { Button } from '../button/index';
import { ErrorState } from '../error-state/index';
import { RedoIcon, UndoIcon } from '../icons';
import { StackHorizontal } from '../stack/index';
import { Surface } from '../surface/index';
import { P, Text } from '../text/index';
import { EditorStageScreen } from './index';

/** The stage's two editing commands, as an editor draws them. */
function HistoryCommands(props: { undo: boolean; redo: boolean }): JSX.Element {
  return (
    <StackHorizontal gap="sm" justify="center" wrap>
      <Button
        title="Undo"
        intent="neutral"
        variant="ghost"
        size="sm"
        disabled={!props.undo}
        startIcon={<UndoIcon size={16} />}
      />
      <Button
        title="Redo"
        intent="neutral"
        variant="ghost"
        size="sm"
        disabled={!props.redo}
        startIcon={<RedoIcon size={16} />}
      />
    </StackHorizontal>
  );
}

/**
 * A level editor: back, the level's name and its details, where the work
 * stands over the board, the board, then undo and redo under it.
 */
export default function EditorStageScreenExample(props: {
  failed?: boolean;
}): JSX.Element {
  return (
    <ScreenExampleFrame>
      <EditorStageScreen
        screenId="editor-stage-example"
        back={{
          label: 'Back to the steps',
          onPress: () => undefined,
          testId: 'editor-back',
        }}
        title="Weekend counts"
        settings={{
          label: 'Details',
          onPress: () => undefined,
          testId: 'editor-details',
        }}
        notices={
          props.failed === true ? (
            <ErrorState
              variant="compact"
              title="Your changes are still here"
              body="No room left on this device."
              retry={{ label: 'Save again', onClick: () => undefined }}
            />
          ) : undefined
        }
        status={
          <Text variant="inherit">
            {props.failed === true
              ? 'Board · Your changes still need to be saved.'
              : 'Board · Saved on this device.'}
          </Text>
        }
        commandsLabel="Editing"
        commands={<HistoryCommands undo redo={false} />}
      >
        <Surface tone="muted" radius="card" padding="2xl">
          <P align="center">Board</P>
        </Surface>
      </EditorStageScreen>
    </ScreenExampleFrame>
  );
}
