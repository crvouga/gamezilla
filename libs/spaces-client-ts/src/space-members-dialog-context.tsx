import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createSignal,
  type Setter,
  useContext,
} from 'solid-js';

type SpaceMembersDialog = {
  readonly open: Accessor<boolean>;
  readonly setOpen: Setter<boolean>;
};

const SpaceMembersDialogContext = createContext<SpaceMembersDialog>();

/** Keep the person's view choice while reconnecting rebuilds space chrome. */
export function SpaceMembersDialogProvider(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  // Another space starts closed.
  const [open, setOpen] = createSignal(() => {
    props.spaceId;
    return false;
  });
  return (
    <SpaceMembersDialogContext value={{ open, setOpen }}>
      {props.children}
    </SpaceMembersDialogContext>
  );
}

export function useSpaceMembersDialog(): SpaceMembersDialog {
  return useContext(SpaceMembersDialogContext);
}
