/**
 * Who draws a space screen's shell while screens move onto `SpaceShell`.
 *
 * Migrated screens render a template and render `<ClaimSpaceShell />`;
 * unmigrated screens do nothing and get the default stage shell.
 *
 * A screen that draws its own template (`SpaceStageTemplate`,
 * `SpaceSetupTemplate`, `SpaceInGameTemplate`, or `SpaceLauncher` inside a
 * shell) mounts {@link ClaimSpaceShell} (or calls {@link useClaimSpaceShell})
 * anywhere in its own tree, the way it mounts `DefineBackButton`: the claim
 * registers during the screen's setup and releases on its cleanup. The
 * nearest {@link SpaceShellClaimFrame} above it then renders its content
 * bare instead of inside the default shell, so a screen never shows two
 * shells and never none. Outside any frame (a story, a test) a claim does
 * nothing.
 */

import {
  type Accessor,
  children,
  createContext,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
  untrack,
  useContext,
} from 'solid-js';

type SpaceShellClaims = {
  /** Registers one claim; the returned function releases it, once. */
  readonly claim: () => () => void;
};

const SpaceShellClaimContext = createContext<SpaceShellClaims | null>(null);

/**
 * Claims the space shell for the calling screen until it unmounts. Call it
 * synchronously in the screen's setup so the frame's first render already
 * knows.
 */
export function useClaimSpaceShell(): void {
  const claims = useContext(SpaceShellClaimContext);
  if (claims === null) return;
  onCleanup(claims.claim());
}

/** Declarative {@link useClaimSpaceShell}: renders nothing. */
export function ClaimSpaceShell(): null {
  useClaimSpaceShell();
  return null;
}

export type SpaceShellClaimFrameProps = {
  /** The default shell around unclaimed content. */
  readonly shell: (content: JSX.Element) => JSX.Element;
  readonly children: JSX.Element;
};

/** Counts the claims below; `claimed` while any is held. */
function createClaims(): SpaceShellClaims & { claimed: Accessor<boolean> } {
  const [count, setCount] = createSignal(0);
  return {
    claimed: () => count() > 0,
    claim: () => {
      setCount((n) => n + 1);
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        setCount((n) => n - 1);
      };
    },
  };
}

/**
 * `children`, once the branch that shows them has mounted. The same content
 * nodes move between the frame's two branches, and Solid removes the
 * branch being left by its own list of nodes, wherever they are by then:
 * placed before that removal, they would leave with it.
 */
function AfterMount(props: { readonly children: JSX.Element }): JSX.Element {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  return <Show when={mounted()}>{props.children}</Show>;
}

/**
 * Renders `children` inside `shell` unless a descendant claimed the shell,
 * then bare. The children are created once, before the first branch is
 * chosen (so a claim made in their setup is already counted), and the same
 * nodes move between the branches when the claim flips: nothing below
 * remounts. Each branch places them once it has mounted, after the branch
 * it replaces is gone, and the shell is made once per release, untracked.
 */
export function SpaceShellClaimFrame(
  props: SpaceShellClaimFrameProps
): JSX.Element {
  const claims = createClaims();
  const content = children(() => (
    <SpaceShellClaimContext.Provider value={claims}>
      {props.children}
    </SpaceShellClaimContext.Provider>
  ));
  const placed = (): JSX.Element => <AfterMount>{content()}</AfterMount>;
  return (
    <Show
      when={claims.claimed()}
      fallback={untrack(() => props.shell(placed()))}
    >
      {placed()}
    </Show>
  );
}
