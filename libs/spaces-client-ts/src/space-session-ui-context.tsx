import { createContext, type JSX, useContext } from 'solid-js';

export type SpaceSessionUiValue = {
  readonly spaceId: string;
  readonly onRequestEnd: () => void;
  readonly onRequestLeave: () => void;
  readonly onRequestRename: () => void;
  readonly onPressHome: () => void;
};

const SpaceSessionUiContext = createContext<SpaceSessionUiValue | null>(null);

export type SpaceSessionUiProviderProps = {
  readonly value: SpaceSessionUiValue;
  readonly children: JSX.Element;
};

/** Session-level UI callbacks + `spaceId` for role/labels under the space room. */
export function SpaceSessionUiProvider(
  props: SpaceSessionUiProviderProps
): JSX.Element {
  return (
    <SpaceSessionUiContext.Provider value={props.value}>
      {props.children}
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
