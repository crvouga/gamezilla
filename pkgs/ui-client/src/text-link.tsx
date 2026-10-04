/** @jsxImportSource solid-js */
/**
 * `TextLink` -- an inline, tint-colored link: a real `<a href>`, so it works
 * without JavaScript and opens in a new tab like any link.
 *
 * `onClick` intercepts the navigation (the default is prevented) for callers
 * that route themselves — a client-side router, or a host that loads the
 * document on its own.
 *
 * @example
 * ```tsx
 * <TextLink href="/signup">{t`Create account`}</TextLink>
 * <TextLink href={url} onClick={() => router.push(url)}>{t`Open`}</TextLink>
 * ```
 */

import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';

export type TextLinkProps = {
  href: string;
  children: JSX.Element;
  /** Handle the navigation in place of the browser (default prevented). */
  onClick?: (() => void) | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export function TextLink(props: TextLinkProps): JSX.Element {
  return (
    <a
      class="text textLink textLabel rounded-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tint"
      href={props.href}
      onClick={(event) => {
        if (props.onClick === undefined) return;
        event.preventDefault();
        props.onClick();
      }}
      {...dataAttrs({ component: 'TextLink', ...props.dataSet })}
    >
      {props.children}
    </a>
  );
}
