/** @jsxImportSource @solidjs/web */
/**
 * Whether the global menu is drawn at the foot of the wide sidebar. The
 * shell's trailing chrome is one composition shared by every bar; the
 * sidebar marks its copy so the menu can name the person beside their face
 * there, while the top bars keep the face alone.
 */

import type { JSX } from '@solidjs/web';
import { createContext, useContext } from 'solid-js';

const GlobalMenuInSidebarContext = createContext<boolean>(false);

/** Marks the global chrome inside it as the sidebar's. */
export function GlobalMenuInSidebar(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <GlobalMenuInSidebarContext value={true}>
      {props.children}
    </GlobalMenuInSidebarContext>
  );
}

/** True inside {@link GlobalMenuInSidebar}. */
export function useGlobalMenuInSidebar(): boolean {
  return useContext(GlobalMenuInSidebarContext);
}
