/** @jsxImportSource solid-js */
/**
 * Text. A screen never picks a size, a weight or a face: it picks a
 * **role** (`variant`), and optionally a **tone**.
 *
 * | Component | Element | Default role |
 * | --- | --- | --- |
 * | `P` | `<p>` | `body` |
 * | `Text` | `<span>`, inline | `body` |
 * | `Strong` / `Em` | `<strong>` / `<em>`, inline | `inherit` |
 * | `Code` | `<code>`, inline | `mono` |
 * | `Time` | `<time>`, inline | `inherit` |
 *
 * `variant="inherit"` keeps the type of the surrounding text and changes
 * only what the other props ask for; use it for a run inside a `P` or a
 * heading (`<P variant="caption">{t`By`} <Text variant="inherit" tone="tint">{name()}</Text></P>`).
 *
 * Children are text content: strings, `<Trans>`, and the inline components
 * of this module. A layout component (`Stack*`, `Grid`, `Surface`) never goes
 * inside text; put the text inside the layout instead. Headings are
 * `H1`–`H6` in `./heading`.
 *
 * @example
 * ```tsx
 * <P variant="caption" tone="secondary" lines={2}>{summary()}</P>
 * <Text variant="label" numeral>{rating()}</Text>
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { componentId, dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { spaced } from '../layout-classes';
import type { TextStyleProps } from '../text-classes';
import { textStyleClass } from '../text-classes';

/**
 * Role names of the product components that still take a `variant` of their
 * own. New code types text with {@link TextRole} and headings with
 * `HeadingSize`.
 */
export type TextVariant =
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'label'
  | 'title'
  | 'subtitle'
  | 'heading'
  /** Compact navigation bar title (stack headers, not page heroes). */
  | 'navigationTitle'
  | 'link'
  | 'mono';

export type TextElement =
  | 'span'
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'label'
  | 'strong'
  | 'em'
  | 'code'
  | 'time';

/**
 * The text roles, each one of the eight text styles: `body` (body 15/22),
 * `bodyBold` and `label` (body-strong 15/22 700), `caption` and `footnote`
 * (caption 13/18, muted), `sectionLabel` (label 12/16 700, muted: the label
 * above a group), `stat` (stat 20/24, numbers only), `mono` (code and
 * identifiers only).
 */
export type TextRole =
  | 'body'
  | 'bodyBold'
  | 'label'
  | 'caption'
  | 'footnote'
  | 'sectionLabel'
  | 'stat'
  | 'mono';

/** Roles a text run may announce itself as. */
export type TextAriaRole = 'status' | 'alert' | 'note' | 'presentation';

export type TextProps = TextStyleProps & {
  /** Text content. Never a layout component. */
  children?: JSX.Element | undefined;
  /** The type role; `inherit` keeps the surrounding text's type. */
  variant?: TextRole | 'inherit' | undefined;
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
  /**
   * Machine-readable marks for tests and harnesses, written as
   * `data-<key>` (a state, an instant, an amount in cents).
   */
  dataSet?: ComponentDataSet | undefined;
  role?: TextAriaRole | undefined;
  'aria-label'?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-live'?: 'off' | 'polite' | 'assertive' | undefined;
  'aria-atomic'?: boolean | undefined;
  'aria-hidden'?: boolean | undefined;
};

export type TimeProps = TextProps & {
  /** Machine-readable instant or duration (the `datetime` attribute). */
  dateTime: string;
};

const ROLE: Readonly<Record<TextRole | 'inherit', string>> = {
  body: 'text textBody',
  bodyBold: 'text textBodyBold',
  label: 'text textLabel',
  caption: 'text textCaption',
  footnote: 'text textFootnote',
  sectionLabel: 'text textSectionLabel',
  stat: 'text textStat',
  mono: 'text textMono',
  inherit: '',
};

type TextHostKind = {
  /** Role when `variant` is unset. */
  readonly role: TextRole | 'inherit';
  /** Flows inside a line of text instead of forming a block. */
  readonly inline: boolean;
  /** Emphasis the element always carries. */
  readonly emphasis?: string;
};

const KIND = {
  P: { role: 'body', inline: false },
  Text: { role: 'body', inline: true },
  Strong: { role: 'inherit', inline: true, emphasis: 'font-semibold' },
  Em: { role: 'inherit', inline: true, emphasis: 'italic' },
  Code: { role: 'mono', inline: true },
  Time: { role: 'inherit', inline: true },
} as const satisfies Record<string, TextHostKind>;

function textClass(kind: TextHostKind, text: TextProps): string {
  const role = text.variant ?? kind.role;
  return spaced([
    ROLE[role],
    // A clamped run is a block: the clamp needs a box to cut.
    kind.inline && role !== 'inherit' && text.lines === undefined
      ? 'inline'
      : undefined,
    kind.emphasis,
    textStyleClass(text),
  ]);
}

/** A paragraph: a block of text in one role. */
export function P(props: TextProps): JSX.Element {
  return (
    <p
      {...dataAttrs(props.dataSet)}
      class={textClass(KIND.P, props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('P')}
      role={props.role}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
      aria-hidden={props['aria-hidden']}
    >
      {props.children}
    </p>
  );
}

/** A run of text inside a line, or a short standalone label. */
export function Text(props: TextProps): JSX.Element {
  return (
    <span
      {...dataAttrs(props.dataSet)}
      class={textClass(KIND.Text, props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Text')}
      role={props.role}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
      aria-hidden={props['aria-hidden']}
    >
      {props.children}
    </span>
  );
}

/** Strong importance. Bolder than the text around it. */
export function Strong(props: TextProps): JSX.Element {
  return (
    <strong
      {...dataAttrs(props.dataSet)}
      class={textClass(KIND.Strong, props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Strong')}
      role={props.role}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
      aria-hidden={props['aria-hidden']}
    >
      {props.children}
    </strong>
  );
}

/** Stress emphasis. Italic in the text around it. */
export function Em(props: TextProps): JSX.Element {
  return (
    <em
      {...dataAttrs(props.dataSet)}
      class={textClass(KIND.Em, props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Em')}
      role={props.role}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
      aria-hidden={props['aria-hidden']}
    >
      {props.children}
    </em>
  );
}

/** An inline identifier, key or command. A block of code is `CodeBlock`. */
export function Code(props: TextProps): JSX.Element {
  return (
    <code
      {...dataAttrs(props.dataSet)}
      class={textClass(KIND.Code, props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('Code')}
      role={props.role}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
      aria-hidden={props['aria-hidden']}
    >
      {props.children}
    </code>
  );
}

/** A date, time or duration, with its machine-readable form. */
export function Time(props: TimeProps): JSX.Element {
  return (
    <time
      {...dataAttrs(props.dataSet)}
      class={textClass(KIND.Time, props)}
      id={props.id}
      dateTime={props.dateTime}
      data-testid={props.testId}
      data-component={componentId('Time')}
      role={props.role}
      aria-label={props['aria-label']}
      aria-describedby={props['aria-describedby']}
      aria-live={props['aria-live']}
      aria-atomic={props['aria-atomic']}
      aria-hidden={props['aria-hidden']}
    >
      {props.children}
    </time>
  );
}
