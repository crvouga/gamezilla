import type { JSX } from 'solid-js';
import { AvatarEditorScreenView } from './avatar-editor-screen-view';
import { AvatarRefusedChangeNotice } from './avatar-refused-change-notice';
import { useAvatarEditor } from './use-avatar-editor';

/** `/profile/avatar`: wires `AvatarEditorScreenView` to the saved avatar. */
export function AvatarEditorScreen(): JSX.Element {
  const editor = useAvatarEditor();
  return (
    <AvatarEditorScreenView
      {...editor}
      notice={<AvatarRefusedChangeNotice />}
    />
  );
}
