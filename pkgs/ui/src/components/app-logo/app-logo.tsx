/** @jsxImportSource solid-js */
/**
 * `AppLogo` -- in-house brand wordmark. Picks up the active theme's brand
 * color and the rounded font stack.
 *
 * @example
 * ```tsx
 * <AppLogo />                  // brand tinted
 * <AppLogo size={48} />        // larger for splash / hero
 * ```
 */

import type { JSX } from 'solid-js';
import { type ComponentDataSet, dataAttrs } from '../../component-id';
import { resolveColor, useThemeTokens } from '../../theme';

export type AppLogoProps = {
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
        class="text font-extrabold tracking-logo"
        style={{
          color: fill(),
          'font-size': `${fontSize()}px`,
          'line-height': `${Math.round(fontSize() * 1.1)}px`,
          'font-family': tokens.fonts.rounded,
        }}
      >
        {'gamezilla'}
      </h1>
    </div>
  );
}
