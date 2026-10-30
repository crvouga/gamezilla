/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import ArrowUpRight from 'lucide-solid/icons/arrow-up-right';
import { type JSX, Show } from 'solid-js';
import { createIcon } from '../create-icon/index';
import { Icon } from '../icon/index';
import { spaced } from '../layout-classes';
import { VisuallyHidden } from '../visually-hidden/index';

const ArrowUpRightIcon = createIcon(ArrowUpRight);

/** `inline` inside a sentence; `standalone` on its own line. */
export type TextLinkVariant = 'inline' | 'standalone';

export type TextLinkTone = 'tint' | 'default' | 'secondary' | 'destructive';

export type TextLinkProps = {
  href: string;
  children: JSX.Element;
  /** Default `inline`. */
  variant?: TextLinkVariant | undefined;
  /** Default `tint`. */
  tone?: TextLinkTone | undefined;
  /** Leaves the app: a new tab, an outward arrow. */
  external?: boolean | undefined;
  /** Save the target under this file name instead of opening it. */
  download?: string | undefined;
  /** Handle a plain click in place of the browser (default prevented). */
  onPress?: (() => void) | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
  'aria-label'?: string | undefined;
};

const TONE: Readonly<Record<TextLinkTone, string>> = {
  tint: '',
  default: 'text-text hover:text-text',
  secondary: 'text-text-secondary hover:text-text',
  destructive: 'text-destructive hover:text-destructive',
};

const VARIANT: Readonly<Record<TextLinkVariant, string>> = {
  inline: '',
  standalone:
    'text textLabel inline-flex self-start items-center min-h-ui-control-md',
};

function linkClass(link: TextLinkProps): string {
  return spaced([
    'textLink rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
    VARIANT[link.variant ?? 'inline'],
    TONE[link.tone ?? 'tint'],
  ]);
}

/** A click the browser should keep: new tab, new window. */
function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/**
 * `TextLink` -- a link that reads as text: a real `<a href>`, so it works
 * without JavaScript, opens in a new tab like any link, and an in-app path
 * is handled by the app router's link interception (the same as
 * `Pressable` with an `href`).
 *
 * - `variant="inline"` (default) sits inside a sentence and takes the
 *   surrounding type; `standalone` is a link on its own line, in the label
 *   role, with a 44px target.
 * - `tone` colors it: `tint` (default) for a link in running text,
 *   `default` / `secondary` for quiet links, `destructive` for a link that
 *   removes something.
 * - `external` opens in a new tab (`target="_blank"`, `rel="noopener
 *   noreferrer"`) and adds an outward arrow and an "opens in a new tab"
 *   announcement.
 * - `download` saves the target instead of opening it, under that file
 *   name (a `data:` or same-origin URL).
 * - `onPress` handles a plain click in place of the browser (the default is
 *   prevented); a modified click (new tab, new window) stays the browser's.
 *
 * @example
 * ```tsx
 * <P>{t`By continuing you accept the`} <TextLink href="/terms">{t`terms`}</TextLink>.</P>
 * <TextLink href={docsUrl} external variant="standalone">{t`Read the guide`}</TextLink>
 * <TextLink href={csvUrl()} download="games.csv" variant="standalone">{t`Download your games`}</TextLink>
 * ```
 */
export function TextLink(props: TextLinkProps): JSX.Element {
  const external = (): boolean => props.external === true;
  return (
    <a
      class={linkClass(props)}
      href={props.href}
      target={external() ? '_blank' : undefined}
      rel={external() ? 'noopener noreferrer' : undefined}
      download={props.download}
      data-testid={props.testId}
      data-component={componentId('TextLink')}
      data-variant={props.variant ?? 'inline'}
      aria-label={props['aria-label']}
      onClick={(event) => {
        if (props.onPress === undefined || isModifiedClick(event)) return;
        event.preventDefault();
        props.onPress();
      }}
    >
      {props.children}
      <Show when={external()}>
        <span class="inline-flex align-middle ps-ui-xs" aria-hidden="true">
          <Icon icon={ArrowUpRightIcon} size="sm" tone="inherit" />
        </span>
        <VisuallyHidden>
          <Trans>(opens in a new tab)</Trans>
        </VisuallyHidden>
      </Show>
    </a>
  );
}
