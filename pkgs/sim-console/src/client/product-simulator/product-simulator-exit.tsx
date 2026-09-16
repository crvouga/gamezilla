import { IconButton, LogOutIcon, RegisterCommand } from '@pkgs/ui';
import type { JSX } from 'solid-js';

const ICON_SIZE = 32;
const GLYPH_SIZE = 16;

/** "Exit simulator" palette command — back to the product app. */
export function ProductSimulatorExitCommand(props: {
  readonly onExit: () => void;
}): JSX.Element {
  return (
    <RegisterCommand
      id="simulator-exit"
      title="Exit simulator"
      category="Navigation"
      icon={LogOutIcon}
      keywords={['app', 'back', 'leave', 'close', 'product']}
      run={async () => {
        props.onExit();
      }}
    />
  );
}

/** Toolbar twin of {@link ProductSimulatorExitCommand}. */
export function ProductSimulatorExitButton(props: {
  readonly onExit: () => void;
}): JSX.Element {
  return (
    <IconButton
      label="Exit simulator"
      size={ICON_SIZE}
      onClick={() => props.onExit()}
    >
      <LogOutIcon size={GLYPH_SIZE} color="icon" />
    </IconButton>
  );
}
