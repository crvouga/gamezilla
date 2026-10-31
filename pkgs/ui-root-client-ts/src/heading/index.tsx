/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { ColorTone } from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';
import { spaced } from '../layout-classes';
import type { TextAlign, TextLines } from '../text-classes';
import { textStyleClass } from '../text-classes';

/** The display type roles a heading may wear. */
export type HeadingSize =
  | 'displayXl'
  | 'stat'
  | 'title'
  | 'heading'
  | 'subtitle'
  | 'navigationTitle'
  | 'label';

export type HeadingProps = {
  /** Text content. Never a layout component. */
  children?: JSX.Element | undefined;
  /** Visual size; the level's default when unset. */
  size?: HeadingSize | undefined;
  tone?: ColorTone | undefined;
  align?: TextAlign | undefined;
  /** Clamp to this many lines. */
  lines?: TextLines | undefined;
  /** Scoreboard figures: ratings, clocks, prices, counts. */
  numeral?: boolean | undefined;
  id?: string | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
  'aria-label'?: string | undefined;
};

const SIZE: Readonly<Record<HeadingSize, string>> = {
  displayXl: 'text textDisplayXl',
  stat: 'text textStat',
  title: 'text textTitle',
  heading: 'text textHeading',
  subtitle: 'text textSubtitle',
  navigationTitle: 'text textNavigationTitle',
  label: 'text textLabel',
};

function headingClass(fallback: HeadingSize, heading: HeadingProps): string {
  return spaced([SIZE[heading.size ?? fallback], textStyleClass(heading)]);
}

/**
 * `H1`–`H6` -- headings. The component is the outline level; `size` is how
 * big it looks, and the two never have to agree: an `H2` can wear `label`
 * in a dense panel, an `H1` can wear `heading` in a dialog.
 *
 * | Level | Default `size` | Text style |
 * | --- | --- | --- |
 * | `H1` | `title` | display 26/30, Unbounded 700 |
 * | `H2` | `heading` | title 18/24 700 |
 * | `H3` | `subtitle` | title 18/24 700 |
 * | `H4` | `navigationTitle` | body-strong 15/22 700 |
 * | `H5`, `H6` | `label` | body-strong 15/22 700 |
 *
 * `displayXl` (display-xl 40/44) is the one headline of an outcome ("You
 * win"); `stat` (20/24, Unbounded 600) is a number that heads a tile.
 *
 * One `H1` per screen, and levels never skip. Children are text content;
 * a run inside a heading keeps its type with `<Text variant="inherit">`.
 *
 * @example
 * ```tsx
 * <H1>{t`Puzzles`}</H1>
 * <H2 size="subtitle" lines={1}>{sectionTitle()}</H2>
 * ```
 */
export function H1(props: HeadingProps): JSX.Element {
  return (
    <h1
      class={headingClass('title', props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('H1')}
      aria-label={props['aria-label']}
    >
      {props.children}
    </h1>
  );
}

export function H2(props: HeadingProps): JSX.Element {
  return (
    <h2
      class={headingClass('heading', props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('H2')}
      aria-label={props['aria-label']}
    >
      {props.children}
    </h2>
  );
}

export function H3(props: HeadingProps): JSX.Element {
  return (
    <h3
      class={headingClass('subtitle', props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('H3')}
      aria-label={props['aria-label']}
    >
      {props.children}
    </h3>
  );
}

export function H4(props: HeadingProps): JSX.Element {
  return (
    <h4
      class={headingClass('navigationTitle', props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('H4')}
      aria-label={props['aria-label']}
    >
      {props.children}
    </h4>
  );
}

export function H5(props: HeadingProps): JSX.Element {
  return (
    <h5
      class={headingClass('label', props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('H5')}
      aria-label={props['aria-label']}
    >
      {props.children}
    </h5>
  );
}

export function H6(props: HeadingProps): JSX.Element {
  return (
    <h6
      class={headingClass('label', props)}
      id={props.id}
      data-testid={props.testId}
      data-component={componentId('H6')}
      aria-label={props['aria-label']}
    >
      {props.children}
    </h6>
  );
}
