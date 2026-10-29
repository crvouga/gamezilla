/** @jsxImportSource solid-js */
/**
 * `AppLogo` -- in-house brand wordmark in the display face, in the brand
 * blue (`tint`) by default: the one blue that marks the product rather than
 * an action. Flat, no gradient, legible at AA in both schemes.
 *
 * @example
 * ```tsx
 * <AppLogo name="acme" />              // brand blue (`tint`)
 * <AppLogo name="acme" size={48} />    // larger for splash / hero
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import type { JSX } from 'solid-js';
import { useThemeTokens } from './theme-context';

export type AppLogoProps = {
  /** The wordmark: the product's name, spelled as its logo spells it. */
  name: string;
  /** Pixel size of the mark (the wordmark scales proportionally). Defaults to 28. */
  size?: number | undefined;
  /** Kept for API parity; the wordmark is always rendered. */
  wordmark?: boolean | undefined;
  /** Color token or raw color for the wordmark. Defaults to `tint`. */
  color?: string | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** Width:height ratio used when rendering the wordmark text element. */
const WORDMARK_HEIGHT_RATIO = 0.7;

export function AppLogo(props: AppLogoProps): JSX.Element {
  const tokens = useThemeTokens();
  const size = () => props.size ?? 28;
  const fill = () =>
    resolveColor(props.color, tokens.colors) ?? tokens.colors.tint;
  const fontSize = () => Math.round(size() * WORDMARK_HEIGHT_RATIO);
  return (
    <div
      class="box flex-row items-center"
      {...dataAttrs({ component: 'AppLogo', ...props.dataSet })}
      style={{ gap: `${Math.max(1, Math.round(size() * 0.25) / 4) * 4}px` }}
    >
      <h1
        class="text appLogo"
        style={{
          ...(props.color !== undefined ? { color: fill() } : {}),
          'font-size': `${fontSize()}px`,
          'line-height': `${Math.round(fontSize() * 1.1)}px`,
        }}
      >
        {props.name}
      </h1>
    </div>
  );
}
