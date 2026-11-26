/** @jsxImportSource @solidjs/web */

import type { JSX } from '@solidjs/web';
import { createContext, untrack, useContext } from 'solid-js';

const ModalTitleIdContext = createContext<string | null>(null);

export type ModalTitleIdProviderProps = {
  id: string;
  children: JSX.Element;
};

/**
 * Links a surface's dialog host to its visible title: `ModalRoot` provides a
 * generated id, headers (`ModalHeader`,
 * `ResponsiveSurfaceHeader`) stamp it on their title node, and the
 * `FocusTrap` host points `aria-labelledby` at it.
 */
export function ModalTitleIdProvider(
  props: ModalTitleIdProviderProps
): JSX.Element {
  // Ids are minted once per surface instance; never reactive.
  const id = untrack(() => props.id);
  return <ModalTitleIdContext value={id}>{props.children}</ModalTitleIdContext>;
}

/** Title element id for the nearest surface, or `undefined` outside one. */
export function useModalTitleId(): string | undefined {
  return useContext(ModalTitleIdContext) ?? undefined;
}
