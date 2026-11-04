/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { MenuList } from '../menu-list/index';
import styles from '../screen-layouts.module.css';
import {
  MenuSectionLayoutProvider,
  useMenuSectionLayout,
} from './layout-context';

export { MenuSectionLayoutProvider, useMenuSectionLayout };

export type MenuSectionProps = {
  /** Section label above the rows, in sentence case. */
  title?: JSX.Element | undefined;
  /** Explanatory note under the rows. */
  footer?: JSX.Element | undefined;
  /**
   * What the group is for, in one short line under its label. Shown only
   * where the label has a column of its own (a desktop menu screen); a
   * phone keeps to the label, so nothing here may be needed to use a row.
   */
  description?: JSX.Element | undefined;
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
 * role: 12/16 semibold, muted, sentence case -- never all caps), one raised
 * panel of rows ({@link MenuList}), and an optional footer note in the
 * caption role. Label and footer sit on the rows' 16px text column, so the
 * eye runs straight down from label to row title. A long label ends in an
 * ellipsis.
 * Stack several in one screen body with `gap-6` so every settings and detail
 * screen reads the same way. On a desktop menu screen
 * ({@link MenuSectionLayoutProvider} `aside`) the label sits in a column of
 * its own beside the rows, so the page uses the width the way desktop
 * settings do and every group's rows share one left edge.
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
  const layout = useMenuSectionLayout();
  const hasTitle = () => props.title !== undefined && props.title !== null;
  const rows = (): JSX.Element => (
    <>
      <MenuList separator={props.separator}>{props.children}</MenuList>
      <Show when={props.footer !== undefined && props.footer !== null}>
        <p class="text textCaption px-4">{props.footer}</p>
      </Show>
    </>
  );
  return (
    <Show
      when={layout() === 'aside'}
      fallback={
        <section
          class="box gap-2"
          {...dataAttrs({ component: 'MenuSection', ...props.dataSet })}
        >
          <Show when={hasTitle()}>
            <h3 class="text textSectionLabel line-clamp-1 px-4">
              {props.title}
            </h3>
          </Show>
          {rows()}
        </section>
      }
    >
      <section
        class={styles['sectionAside']}
        {...dataAttrs({
          component: 'MenuSection',
          layout: 'aside',
          ...props.dataSet,
        })}
      >
        <div class={styles['sectionAsideLabel']}>
          <Show when={hasTitle()}>
            <h3 class="text textBody font-semibold">{props.title}</h3>
          </Show>
          <Show
            when={props.description !== undefined && props.description !== null}
          >
            <p class="text textCaption">{props.description}</p>
          </Show>
        </div>
        <div class="box gap-2 min-w-0">{rows()}</div>
      </section>
    </Show>
  );
}
