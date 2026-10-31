/** @jsxImportSource solid-js */

import type { BottomSheetHost } from '@pkgs/ui-root-shared-ts/bottom-sheet-host-types';
import { createContext, type JSX, untrack, useContext } from 'solid-js';
import { createWebBottomSheetHost } from '../web-bottom-sheet/index';

const BottomSheetHostContext = createContext<BottomSheetHost>();

let defaultHost: BottomSheetHost | undefined;

function resolveDefaultHost(): BottomSheetHost {
  defaultHost ??= createWebBottomSheetHost();
  return defaultHost;
}

export type BottomSheetHostProviderProps = {
  host: BottomSheetHost;
  children: JSX.Element;
};

/**
 * Bottom-sheet host injection. The web sheet ({@link createWebBottomSheetHost})
 * is the default -- consumers never need a provider. The provider indirection
 * exists only so tests (and harness trees) can swap in
 * {@link createPassthroughBottomSheetHost} or a recording host.
 */
export function BottomSheetHostProvider(
  props: BottomSheetHostProviderProps
): JSX.Element {
  // The host is static composition-root configuration.
  const host = untrack(() => props.host);
  return (
    <BottomSheetHostContext.Provider value={host}>
      {props.children}
    </BottomSheetHostContext.Provider>
  );
}

/** Nearest provided host, else the web CSS bottom sheet. */
export function useBottomSheetHost(): BottomSheetHost {
  return useContext(BottomSheetHostContext) ?? resolveDefaultHost();
}
