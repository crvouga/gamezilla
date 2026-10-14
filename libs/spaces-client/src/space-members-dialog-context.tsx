import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
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
  const [open, setOpen] = createSignal(false);
  createEffect(() => {
    props.spaceId;
    setOpen(false);
  });
  return (
    <SpaceMembersDialogContext.Provider value={{ open, setOpen }}>
      {props.children}
    </SpaceMembersDialogContext.Provider>
  );
}

export function useSpaceMembersDialog(): SpaceMembersDialog {
  const dialog = useContext(SpaceMembersDialogContext);
  if (dialog === undefined)
    throw new Error('Space members dialog requires its route provider');
  return dialog;
}
