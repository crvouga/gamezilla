/** @jsxImportSource solid-js */

import { type Accessor, createContext, type JSX, useContext } from 'solid-js';

/**
 * How {@link MenuSection}s lay out: `stacked` (label over rows, the default
 * everywhere) or `aside` (label beside rows). A desktop menu screen sets
 * `aside` for its own sections, so a settings page fills the column the way
 * desktop settings do; sections inside sheets, rails and cards stay stacked.
 */
export type MenuSectionLayout = 'stacked' | 'aside';

const stacked: Accessor<MenuSectionLayout> = () => 'stacked';

const MenuSectionLayoutContext =
  createContext<Accessor<MenuSectionLayout>>(stacked);

export function MenuSectionLayoutProvider(props: {
  layout: Accessor<MenuSectionLayout>;
  children: JSX.Element;
}): JSX.Element {
  return (
    <MenuSectionLayoutContext.Provider value={props.layout}>
      {props.children}
    </MenuSectionLayoutContext.Provider>
  );
}

export function useMenuSectionLayout(): Accessor<MenuSectionLayout> {
  return useContext(MenuSectionLayoutContext) ?? stacked;
}
