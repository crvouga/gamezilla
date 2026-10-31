/**
 * Source of the generated `token-names.ts`: one `as const` name array and one
 * string-literal union per semantic scale of `design-tokens.json`.
 *
 * Every visual prop of the design system is typed as one of these unions, so
 * a component can be handed a token name and nothing else. Pure; the
 * generator script (`pkgs/ui-root-client-ts/scripts/generate-tokens-css.ts`)
 * writes the result and `tokens:verify` fails when the file is stale.
 */

import { tokenNames } from './design-tokens';
import {
  breakpoint,
  layer,
  motion,
  radius,
  size,
  space,
  tone,
  typography,
} from './design-tokens.json';

export type TokenScale = {
  /** Union type name, e.g. `SpaceToken`. */
  readonly type: string;
  /** Name-array constant, e.g. `SPACE_TOKENS`. */
  readonly list: string;
  readonly doc: string;
  readonly names: readonly string[];
};

/** Line width of the repo formatter; a longer array breaks one name a line. */
const LINE_WIDTH = 80;

/**
 * The scales, in the order they are written. `inherit`, `transparent` and
 * `full` are CSS keywords a prop may also name; they have no token value.
 */
export function tokenScales(): readonly TokenScale[] {
  return [
    {
      type: 'SpaceToken',
      list: 'SPACE_TOKENS',
      doc: 'Gap and padding steps (`--ui-space-<name>`).',
      names: tokenNames(space.size),
    },
    {
      type: 'RadiusToken',
      list: 'RADIUS_TOKENS',
      doc: 'Corner radius by hierarchy (`--ui-radius-<name>`).',
      names: tokenNames(radius.role),
    },
    {
      type: 'ColorTone',
      list: 'COLOR_TONES',
      doc: 'Text and glyph color roles. `inherit` takes the parent color.',
      names: [...tokenNames(tone.text), 'inherit'],
    },
    {
      type: 'SurfaceTone',
      list: 'SURFACE_TONES',
      doc: 'Fill color roles of a painted container.',
      names: [...tokenNames(tone.surface), 'transparent'],
    },
    {
      type: 'TextStyle',
      list: 'TEXT_STYLES',
      doc: 'Text styles (`--ui-text-<name>-*`): a face, size, weight and leading.',
      names: tokenNames(typography),
    },
    {
      type: 'IconSizeToken',
      list: 'ICON_SIZE_TOKENS',
      doc: 'Glyph box sizes (`--ui-icon-size-<name>`).',
      names: tokenNames(size.icon),
    },
    {
      type: 'BreakpointToken',
      list: 'BREAKPOINT_TOKENS',
      doc: 'Minimum viewport widths a responsive prop may branch on.',
      names: tokenNames(breakpoint),
    },
    {
      type: 'ControlSizeToken',
      list: 'CONTROL_SIZE_TOKENS',
      doc: 'Control heights (`--ui-control-size-<name>`).',
      names: tokenNames(size.control),
    },
    {
      type: 'MaxWidthToken',
      list: 'MAX_WIDTH_TOKENS',
      doc: 'Reading and layout measures (`--ui-max-width-<name>`).',
      names: [...tokenNames(size.maxWidth), 'full'],
    },
    {
      type: 'DurationToken',
      list: 'DURATION_TOKENS',
      doc: 'Transition durations (`--ui-duration-<name>`).',
      names: tokenNames(motion.duration),
    },
    {
      type: 'EasingToken',
      list: 'EASING_TOKENS',
      doc: 'Transition curves (`--ui-easing-<name>`).',
      names: tokenNames(motion.easing),
    },
    {
      type: 'LayerToken',
      list: 'LAYER_TOKENS',
      doc: 'Stacking layers, lowest first (`--ui-layer-<name>`).',
      names: tokenNames(layer),
    },
  ];
}

function renderScale(scale: TokenScale): string {
  const quoted = scale.names.map((name) => `'${name}'`);
  const oneLine = `export const ${scale.list} = [${quoted.join(', ')}] as const;`;
  const array =
    oneLine.length <= LINE_WIDTH
      ? oneLine
      : `export const ${scale.list} = [\n${quoted
          .map((name) => `  ${name},\n`)
          .join('')}] as const;`;
  return [
    `/** ${scale.doc} */`,
    array,
    `export type ${scale.type} = (typeof ${scale.list})[number];`,
  ].join('\n');
}

/** Full contents of `token-names.ts`. Pure; the generator script writes it. */
export function renderTokenNamesTs(): string {
  return (
    [
      '// GENERATED from pkgs/ui-root-shared-ts/src/design-tokens.json — do not edit.',
      ...tokenScales().map(renderScale),
    ].join('\n\n') + '\n'
  );
}
