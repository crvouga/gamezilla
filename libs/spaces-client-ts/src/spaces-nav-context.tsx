/**
 * Spaces-package back-button registry.
 *
 * Each spaces screen renders at most one {@link DefineBackButton} to declare
 * its back behavior; the package shell ({@link SpacesNavProvider}) collects
 * the registrations and exposes the active handler to the chrome via
 * {@link useSpacesNavBack}. The actual button is rendered once by the chrome
 * (mobile top bar or wide rail header) instead of per-screen.
 *
 * Registration semantics: the most recently registered handler wins. In our
 * codebase only one DefineBackButton is mounted at a time per provider, so
 * the simple stack is sufficient and predictable.
 */

import { useConfirmNavigation } from '@pkgs/ui-root-client-ts/pending-navigation';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  type JSX,
  onCleanup,
  useContext,
} from 'solid-js';

export type SpacesNavBackHandler = () => void;

type Entry = {
  readonly id: string;
  readonly handler: SpacesNavBackHandler;
  readonly label: string | undefined;
};

type SpacesNavContextValue = {
  /** Active back handler, or `null` when no screen has registered one. */
  readonly current: SpacesNavBackHandler | null;
  /** The active back control's destination name, when it gave one. */
  readonly label: string | undefined;
  /** Pass a non-null handler to register/replace, `null` to clear. */
  readonly setHandler: (
    id: string,
    handler: SpacesNavBackHandler | null,
    label?: string | undefined
  ) => void;
};

const SpacesNavContext = createContext<SpacesNavContextValue | null>(null);

export type SpacesNavProviderProps = {
  children: JSX.Element;
};

export function SpacesNavProvider(props: SpacesNavProviderProps): JSX.Element {
  const [entries, setEntries] = createSignal<readonly Entry[]>([]);

  const setHandler: SpacesNavContextValue['setHandler'] = (
    id,
    handler,
    label
  ) => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      if (handler === null) return filtered;
      return [...filtered, { id, handler, label }];
    });
  };

  const top = createMemo<Entry | null>(() => entries().at(-1) ?? null);
  // Keyed on the handler alone, so a label change never rebuilds the bar.
  const current = createMemo<SpacesNavBackHandler | null>(
    () => top()?.handler ?? null
  );

  const value: SpacesNavContextValue = {
    get current() {
      return current();
    },
    get label() {
      return top()?.label;
    },
    setHandler,
  };

  return (
    <SpacesNavContext.Provider value={value}>
      {props.children}
    </SpacesNavContext.Provider>
  );
}

function useSpacesNavContext(): SpacesNavContextValue {
  const v = useContext(SpacesNavContext);
  if (v === null) {
    throw new Error(
      'Spaces nav hooks must be used within <SpacesNavProvider>.'
    );
  }
  return v;
}

/** Read-only accessor used by the chrome to render the back affordance. */
export function useSpacesNavBack(): Accessor<SpacesNavBackHandler | null> {
  const nav = useSpacesNavContext();
  return () => nav.current;
}

/** The chrome back control's destination name, when the screen gave one. */
export function useSpacesNavBackLabel(): Accessor<string | undefined> {
  const nav = useSpacesNavContext();
  return () => nav.label;
}

export type DefineBackButtonProps = {
  /** Invoked when the user taps the chrome-rendered back button. */
  onPress: () => void;
  /**
   * Where back goes, named for the chrome ("Games"), so leaving the room
   * and moving within it never read alike. "Back" when omitted.
   */
  label?: string | undefined;
};

/**
 * Declarative back-handler registration. Mount inside any spaces screen
 * that wants the chrome to expose a back button; unmount removes the
 * handler automatically. Latest registration wins, so navigating between
 * sibling screens works without manual coordination.
 *
 * @example
 * ```tsx
 * function ChessSettingsScreen() {
 *   const gameScreen = useGameScreen();
 *   return (
 *     <>
 *       <DefineBackButton onPress={() => gameScreen.showChoices()} />
 *       <MainMenuScreen items={items} />
 *     </>
 *   );
 * }
 * ```
 */
export function DefineBackButton(props: DefineBackButtonProps): null {
  const { setHandler } = useSpacesNavContext();
  const confirmNavigation = useConfirmNavigation();
  const id = createUniqueId();

  createEffect(() => {
    setHandler(id, () => confirmNavigation(() => props.onPress()), props.label);
    onCleanup(() => {
      setHandler(id, null);
    });
  });

  return null;
}
