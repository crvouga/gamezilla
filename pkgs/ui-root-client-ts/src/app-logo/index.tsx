/** @jsxImportSource solid-js */

import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import { type JSX, Show } from 'solid-js';
import { useThemeTokens } from '../theme-context/index';

const mark = new URL('./mark.svg', import.meta.url).href;

export type AppLogoProps = {
  /** Pixel size of the mark (the wordmark scales proportionally). Defaults to 28. */
  size?: number | undefined;
  /** Show the wordmark alongside the monster mark. Defaults to true. */
  wordmark?: boolean | undefined;
  /** Semantic color token for the wordmark. Defaults to text. */
  color?: ColorTokenName | undefined;
  dataSet?: ComponentDataSet | undefined;
};

/** Width:height ratio used when rendering the wordmark text element. */
const WORDMARK_HEIGHT_RATIO = 0.7;

/**
 * `AppLogo` — emerald monster mark and Unbounded wordmark. The intrinsic
 * brand artwork is a scoped color exception; surrounding chrome stays neutral.
 * Mark-only instances retain the accessible product name. This is branding,
 * not a page heading.
 *
 * @example
 * ```tsx
 * <AppLogo />                  // monster mark + wordmark
 * <AppLogo size={48} />        // larger for splash / hero
 * ```
 */
export function AppLogo(props: AppLogoProps): JSX.Element {
  const tokens = useThemeTokens();
  const size = () => props.size ?? 28;
  const fill = () =>
    resolveColor(props.color, tokens.colors) ?? tokens.colors.text;
  const fontSize = () => Math.round(size() * WORDMARK_HEIGHT_RATIO);
  return (
    <div
      class="box flex-row items-center"
      {...dataAttrs({ component: 'AppLogo', ...props.dataSet })}
      role="img"
      aria-label="Gamezilla"
      style={{ gap: `${Math.max(1, Math.round(size() / 16)) * 4}px` }}
    >
      <img
        src={mark}
        width={size()}
        height={size()}
        alt=""
        aria-hidden="true"
      />
      <Show when={props.wordmark !== false}>
        <span
          class="text textTitle"
          style={{
            color: fill(),
            'font-size': `${fontSize()}px`,
            'line-height': `${Math.round(fontSize() * 1.1)}px`,
          }}
        >
          {'gamezilla'}
        </span>
      </Show>
    </div>
  );
}
