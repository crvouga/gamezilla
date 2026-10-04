/** @jsxImportSource solid-js */
/**
 * `MenuSection` -- titled group of {@link MenuRow}s.
 *
 * The settings idiom: a quiet section label, a full-bleed {@link MenuList},
 * and an optional footer note. Stack several inside one screen body with
 * `gap: 5` so every settings / detail screen reads the same way.
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
  /** Section label above the rows. */
  title?: JSX.Element | undefined;
  /** Explanatory note under the rows. */
  footer?: JSX.Element | undefined;
  children: JSX.Element;
  /** Hairline separators between rows. Defaults to `true`. */
  separator?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

export function MenuSection(props: MenuSectionProps): JSX.Element {
  return (
    <section
      class="box gap-1"
      {...dataAttrs({ component: 'MenuSection', ...props.dataSet })}
    >
      <Show when={props.title !== undefined && props.title !== null}>
        <h3 class="text textLabel line-clamp-1 text-text-secondary">
          {props.title}
        </h3>
      </Show>
      <MenuList separator={props.separator}>{props.children}</MenuList>
      <Show when={props.footer !== undefined && props.footer !== null}>
        <p class="text textCaption">{props.footer}</p>
      </Show>
    </section>
  );
}
