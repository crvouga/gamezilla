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

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export type SpacesNavBackHandler = () => void;

type Entry = {
  readonly id: string;
  readonly handler: SpacesNavBackHandler;
};

type SpacesNavContextValue = {
  /** Active back handler, or `null` when no screen has registered one. */
  readonly current: SpacesNavBackHandler | null;
  /** Pass a non-null handler to register/replace, `null` to clear. */
  readonly setHandler: (
    id: string,
    handler: SpacesNavBackHandler | null
  ) => void;
};

const SpacesNavContext = createContext<SpacesNavContextValue | null>(null);

export type SpacesNavProviderProps = {
  children: ReactNode;
};

export function SpacesNavProvider({
  children,
}: SpacesNavProviderProps): ReactNode {
  const [entries, setEntries] = useState<readonly Entry[]>([]);

  const setHandler = useCallback<SpacesNavContextValue['setHandler']>(
    (id, handler) => {
      setEntries((prev) => {
        const filtered = prev.filter((e) => e.id !== id);
        if (handler === null) return filtered;
        return [...filtered, { id, handler }];
      });
    },
    []
  );

  const current: SpacesNavBackHandler | null =
    entries.length > 0 ? (entries[entries.length - 1]?.handler ?? null) : null;

  const value = useMemo<SpacesNavContextValue>(
    () => ({ current, setHandler }),
    [current, setHandler]
  );

  return (
    <SpacesNavContext.Provider value={value}>
      {children}
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
export function useSpacesNavBack(): SpacesNavBackHandler | null {
  return useSpacesNavContext().current;
}

export type DefineBackButtonProps = {
  /** Invoked when the user taps the chrome-rendered back button. */
  onPress: () => void;
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
 *   const dispatch = useSpaceRoomDispatch();
 *   return (
 *     <>
 *       <DefineBackButton onPress={() => dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }))} />
 *       <MainMenuScreen items={items} />
 *     </>
 *   );
 * }
 * ```
 */
export function DefineBackButton({ onPress }: DefineBackButtonProps): null {
  const { setHandler } = useSpacesNavContext();
  const id = useId();
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  useEffect(() => {
    setHandler(id, () => onPressRef.current());
    return () => {
      setHandler(id, null);
    };
  }, [id, setHandler]);

  return null;
}
