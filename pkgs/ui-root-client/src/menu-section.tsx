/** @jsxImportSource solid-js */
/**
 * `MenuSection` -- titled group of {@link MenuRow}s.
 *
 * The settings idiom: a section title in the display face, a panel of rows
 * ({@link MenuList}), and an optional footer note. Title and footer align
 * to the panel edge, like every block on the page. Stack several in one
 * screen body with `gap-6` so every settings and detail screen reads the
 * same way.
 *
 * @example
 * ```tsx
 * <MenuSection title="Preferences" footer="Sound never changes device volume.">
 *   <MenuRow title="Appearance" value="Dark" onClick={goTheme} />
 *   <MenuRow title="Sound" trailing={<Switch … />} />
 * </MenuSection>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared/component-id';
import { type JSX, Show } from 'solid-js';
import { MenuList } from './menu-list';

export type MenuSectionProps = {
  /** Section title above the rows. */
  title?: JSX.Element | undefined;
  /** Explanatory note under the rows. */
  footer?: JSX.Element | undefined;
  children: JSX.Element;
  /** Use a group when rows contain links or form controls. */
  role?: 'menu' | 'group' | undefined;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function MenuSection(props: MenuSectionProps): JSX.Element {
  return (
    <section
      class="box gap-2"
      {...dataAttrs({ component: 'MenuSection', ...props.dataSet })}
    >
      <Show when={props.title !== undefined && props.title !== null}>
        <h3 class="text textNavigationTitle line-clamp-1">{props.title}</h3>
      </Show>
      <MenuList separator={props.separator} role={props.role}>
        {props.children}
      </MenuList>
      <Show when={props.footer !== undefined && props.footer !== null}>
        <p class="text textCaption">{props.footer}</p>
      </Show>
    </section>
  );
}
