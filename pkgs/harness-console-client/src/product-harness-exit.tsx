import { IconButton } from '@pkgs/ui-root-client/icon-button';
import { LogOutIcon } from '@pkgs/ui-root-client/icons';
import { RegisterCommand } from '@pkgs/ui-root-client/register-command';
import type { JSX } from 'solid-js';

const ICON_SIZE = 32;
const GLYPH_SIZE = 16;

/** "Exit harness" palette command — back to the product app. */
export function ProductHarnessExitCommand(props: {
  readonly onExit: () => void;
}): JSX.Element {
  return (
    <RegisterCommand
      id="harness-exit"
      title="Exit harness"
      category="Navigation"
      icon={LogOutIcon}
      keywords={['app', 'back', 'leave', 'close', 'product']}
      run={async () => {
        props.onExit();
      }}
    />
  );
}

/** Toolbar twin of {@link ProductHarnessExitCommand}. */
export function ProductHarnessExitButton(props: {
  readonly onExit: () => void;
}): JSX.Element {
  return (
    <IconButton
      label="Exit harness"
      size={ICON_SIZE}
      onClick={() => props.onExit()}
    >
      <LogOutIcon size={GLYPH_SIZE} color="icon" />
    </IconButton>
  );
}
