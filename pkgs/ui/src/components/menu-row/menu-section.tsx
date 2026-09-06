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

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';
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
    <Box
      as="section"
      sx={{ gap: 1 }}
      dataSet={{ component: 'MenuSection', ...props.dataSet }}
    >
      <Show when={props.title !== undefined && props.title !== null}>
        <Text
          variant="label"
          as="h3"
          numberOfLines={1}
          sx={{ color: 'textSecondary' }}
          label={props.title}
        />
      </Show>
      <MenuList separator={props.separator}>{props.children}</MenuList>
      <Show when={props.footer !== undefined && props.footer !== null}>
        <Text variant="caption" label={props.footer} />
      </Show>
    </Box>
  );
}
