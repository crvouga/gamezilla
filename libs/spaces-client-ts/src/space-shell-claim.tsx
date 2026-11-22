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

import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import {
  type Accessor,
  children,
  createContext,
  createSignal,
  type JSX,
  onCleanup,
  Show,
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
 * Renders `children` inside `shell` unless a descendant claimed the shell,
 * then bare. The children are created once, before the first branch is
 * chosen (so a claim made in their setup is already counted), and the same
 * nodes move between the branches when the claim flips: nothing below
 * remounts. A claimed screen sits in one box filling the frame, so each
 * branch is a single node: swapping one branch for the other never removes
 * the children the other has just taken in.
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
  return (
    <Show when={claims.claimed()} fallback={props.shell(content())}>
      <StackVertical grow self="stretch" minHeight="none">
        {content()}
      </StackVertical>
    </Show>
  );
}
