/** @jsxImportSource solid-js */

import { createContext, type JSX, untrack, useContext } from 'solid-js';

const ModalTitleIdContext = createContext<string>();

export type ModalTitleIdProviderProps = {
  id: string;
  children: JSX.Element;
};

/**
 * Links a surface's dialog host to its visible title: `ModalRoot` / the web
 * bottom sheet provide a generated id, headers (`ModalHeader`,
 * `ResponsiveSurfaceHeader`) stamp it on their title node, and the
 * `FocusTrap` host points `aria-labelledby` at it.
 */
export function ModalTitleIdProvider(
  props: ModalTitleIdProviderProps
): JSX.Element {
  // Ids are minted once per surface instance; never reactive.
  const id = untrack(() => props.id);
  return (
    <ModalTitleIdContext.Provider value={id}>
      {props.children}
    </ModalTitleIdContext.Provider>
  );
}

/** Title element id for the nearest surface, or `undefined` outside one. */
export function useModalTitleId(): string | undefined {
  return useContext(ModalTitleIdContext);
}
