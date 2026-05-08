import { createContext, useContext, type ReactNode } from 'react';

export type SpaceSessionUiValue = {
  spaceId: string;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
};

const SpaceSessionUiContext = createContext<SpaceSessionUiValue | null>(null);

export type SpaceSessionUiProviderProps = {
  value: SpaceSessionUiValue;
  children: ReactNode;
};

/** Session-level UI callbacks + `spaceId` for role/labels under the space room. */
export function SpaceSessionUiProvider({
  value,
  children,
}: SpaceSessionUiProviderProps): ReactNode {
  return (
    <SpaceSessionUiContext.Provider value={value}>
      {children}
    </SpaceSessionUiContext.Provider>
  );
}

export function useSpaceSessionUi(): SpaceSessionUiValue {
  const v = useContext(SpaceSessionUiContext);
  if (v === null) {
    throw new Error(
      'useSpaceSessionUi must be used within SpaceSessionUiProvider'
    );
  }
  return v;
}
