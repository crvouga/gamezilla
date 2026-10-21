/** @jsxImportSource solid-js */
/**
 * `MenuSection` -- titled group of {@link MenuRow}s.
 *
 * The settings idiom: a quiet section title (`textCaption`, secondary),
 * one hairline panel of rows ({@link MenuList}), and an optional
 * footer note in the caption role. Title and footer sit on the rows' 16px
 * text column, so the eye runs straight down from heading to row title.
 * Stack several in one screen body with `gap-6` so every settings and detail
 * screen reads the same way.
 *
 * @example
 * ```tsx
 * <MenuSection title="Preferences" footer="Sound never changes device volume.">
 *   <MenuRow title="Appearance" value="Dark" onClick={goTheme} />
 *   <MenuRow title="Sound" trailing={<Switch … />} />
 * </MenuSection>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
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
        <h3 class="text textCaption line-clamp-1 px-4">{props.title}</h3>
      </Show>
      <MenuList separator={props.separator} role={props.role}>
        {props.children}
      </MenuList>
      <Show when={props.footer !== undefined && props.footer !== null}>
        <p class="text textCaption px-4">{props.footer}</p>
      </Show>
    </section>
  );
}
