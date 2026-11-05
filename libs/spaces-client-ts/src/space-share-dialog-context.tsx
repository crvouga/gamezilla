import {
  type Accessor,
  createContext,
  createEffect,
  createSignal,
  type JSX,
  type Setter,
  useContext,
} from 'solid-js';

type SpaceShareDialog = {
  readonly open: Accessor<boolean>;
  readonly setOpen: Setter<boolean>;
};

const SpaceShareDialogContext = createContext<SpaceShareDialog>();

/**
 * Whether the space's Share sheet (its link and Add people) is open, for
 * every control in the space that opens it: ⋯ › Share in the header, and
 * Invite friends beside who is here.
 */
export function SpaceShareDialogProvider(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  createEffect(() => {
    props.spaceId;
    setOpen(false);
  });
  return (
    <SpaceShareDialogContext.Provider value={{ open, setOpen }}>
      {props.children}
    </SpaceShareDialogContext.Provider>
  );
}

/** The space's Share sheet state; undefined outside a space's route. */
export function useSpaceShareDialog(): SpaceShareDialog | undefined {
  return useContext(SpaceShareDialogContext);
}
