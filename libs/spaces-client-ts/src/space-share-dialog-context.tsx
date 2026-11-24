import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createSignal,
  type Setter,
  useContext,
} from 'solid-js';

type SpaceShareDialog = {
  readonly open: Accessor<boolean>;
  readonly setOpen: Setter<boolean>;
};

const SpaceShareDialogContext = createContext<SpaceShareDialog | null>(null);

/**
 * Whether the space's Share sheet (its link and Add people) is open, for
 * every control in the space that opens it: Share in the space settings,
 * Invite in the people row, and Invite friends beside who is here.
 */
export function SpaceShareDialogProvider(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  // Another space starts closed.
  const [open, setOpen] = createSignal(() => {
    props.spaceId;
    return false;
  });
  return (
    <SpaceShareDialogContext value={{ open, setOpen }}>
      {props.children}
    </SpaceShareDialogContext>
  );
}

/** The space's Share sheet state; null outside a space's route. */
export function useSpaceShareDialog(): SpaceShareDialog | null {
  return useContext(SpaceShareDialogContext);
}
