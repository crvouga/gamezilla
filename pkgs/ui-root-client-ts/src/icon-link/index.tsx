/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { ICON_BUTTON_MIN_HIT_TARGET } from '../icon-button/index';

export type IconLinkProps = {
  href: string;
  /** Accessible name. */
  label: string;
  children: JSX.Element;
  /** Handle the navigation in place of the browser (default prevented). */
  onClick?: (() => void) | undefined;
  /** Visual disc diameter in pixels. Defaults to 40. */
  size?: number | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `IconLink` -- a circular icon target that is a real `<a href>` rather than a
 * button: the back arrow of a multi-step flow, say, where the previous step
 * is a URL that must work without JavaScript.
 *
 * `label` is the accessible name (icons inside are decorative). `onClick`
 * intercepts the navigation (default prevented) for callers that route
 * themselves. The hit target never drops below
 * {@link ICON_BUTTON_MIN_HIT_TARGET}.
 *
 * @example
 * ```tsx
 * <IconLink href={previousStep} label={t`Back`}>
 *   <ChevronLeftIcon size={20} color="text" />
 * </IconLink>
 * ```
 */
export function IconLink(props: IconLinkProps): JSX.Element {
  const size = (): number => props.size ?? 40;
  const target = (): number => Math.max(size(), ICON_BUTTON_MIN_HIT_TARGET);
  return (
    <a
      class="clickable clickableTint items-center justify-center rounded-full"
      href={props.href}
      aria-label={props.label}
      onClick={(event) => {
        if (props.onClick === undefined) return;
        event.preventDefault();
        props.onClick();
      }}
      style={{ width: `${target()}px`, height: `${target()}px` }}
      {...dataAttrs({ component: 'IconLink', ...props.dataSet })}
    >
      {props.children}
    </a>
  );
}
