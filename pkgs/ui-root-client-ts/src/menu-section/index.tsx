/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { MenuList } from '../menu-list/index';

export type MenuSectionProps = {
  /** Section label above the rows, in sentence case. */
  title?: JSX.Element | undefined;
  /** Explanatory note under the rows. */
  footer?: JSX.Element | undefined;
  children: JSX.Element;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `MenuSection` -- titled group of {@link MenuRow}s.
 *
 * The settings idiom: a section label above the group (the `sectionLabel`
 * role: 12/16 bold, muted, sentence case -- never all caps), one raised
 * panel of rows ({@link MenuList}), and an optional footer note in the
 * caption role. Label and footer sit on the rows' 16px text column, so the
 * eye runs straight down from label to row title. A long label ends in an
 * ellipsis.
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
export function MenuSection(props: MenuSectionProps): JSX.Element {
  return (
    <section
      class="box gap-2"
      {...dataAttrs({ component: 'MenuSection', ...props.dataSet })}
    >
      <Show when={props.title !== undefined && props.title !== null}>
        <h3 class="text textSectionLabel line-clamp-1 px-4">{props.title}</h3>
      </Show>
      <MenuList separator={props.separator}>{props.children}</MenuList>
      <Show when={props.footer !== undefined && props.footer !== null}>
        <p class="text textCaption px-4">{props.footer}</p>
      </Show>
    </section>
  );
}
