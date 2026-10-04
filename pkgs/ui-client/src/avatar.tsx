/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-shared/css-px';

/**
 * `Avatar` -- circular avatar primitive.
 *
 * Renders the first content source provided, in priority order:
 *   `svg` > `uri` > `initials` > `icon` > (empty plate).
 *
 * Always draws a 1px theme `border` ring so faces stay enclosed on any
 * surface (list rows, chrome, empty plates). Outer diameter stays `size`
 * (border-box); content is clipped under the ring.
 *
 * Color props (`background`, `foreground`) accept either a theme color
 * token name (e.g. `'tint'`, `'surface'`, `'outline'`) or a raw color
 * string (e.g. `'#fff'`, `'rgba(255,255,255,0.2)'`).
 *
 * @example
 * ```tsx
 * <Avatar uri="https://example.com/photo.jpg" alt="Jane" size={48} />
 * <Avatar initials="JD" size={48} />
 * <Avatar svg={dicebearSvgString} size={64} />
 * <Avatar icon={UserIcon} size={48} background="outline" />
 * <Avatar size={48} background="surface" /> // empty placeholder plate
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-shared/component-id';
import { dataAttrs } from '@pkgs/ui-shared/component-id';
import { bestOnColor } from '@pkgs/ui-shared/contrast';
import { resolveColor } from '@pkgs/ui-shared/resolve-color';
import { svgToDataUri } from '@pkgs/ui-shared/svg-data-uri';
import { createMemo, type JSX, Match, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import styles from './avatar.module.css';
import type { IconComponent } from './create-icon';
import { useThemeTokens } from './theme-context';

/** Minimal enclosing ring on every avatar face. */
export const AVATAR_BORDER_WIDTH = 1;

const DEFAULT_SIZE = 40;
const DEFAULT_BACKGROUND = 'tint';

export type AvatarProps = {
  /** Diameter in pixels. Defaults to `40`. */
  size?: number | undefined;
  /** Background color token or raw color. Defaults to `'tint'`. */
  background?: string | undefined;
  /**
   * Foreground (icon / initials) color token or raw color. When omitted it is
   * auto-derived from `background` for a contrast-safe label in both schemes.
   */
  foreground?: string | undefined;
  /**
   * Raw SVG XML string (e.g. from a generative avatar library such as
   * DiceBear). Highest-priority content source. Trusted markup only.
   */
  svg?: string | null | undefined;
  /** Image URL to render inside the circle (`<img>`). */
  uri?: string | undefined;
  /** Alternative text for `uri`. Omit for decorative images. */
  alt?: string | undefined;
  /** 1–2 character text fallback (truncated to 2 chars). */
  initials?: string | undefined;
  /** Icon glyph fallback. */
  icon?: IconComponent | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function Avatar(props: AvatarProps): JSX.Element {
  const tokens = useThemeTokens();
  const size = () => props.size ?? DEFAULT_SIZE;
  const background = () => props.background ?? DEFAULT_BACKGROUND;
  const foreground = createMemo((): string => {
    if (props.foreground !== undefined) {
      return resolveColor(props.foreground, tokens.colors) ?? props.foreground;
    }
    const raw = resolveColor(background(), tokens.palette()) ?? background();
    return bestOnColor(raw).fg;
  });
  return (
    <span
      class="box inline-flex rounded-full border-border overflow-hidden items-center justify-center"
      {...dataAttrs({ component: 'Avatar', ...props.dataSet })}
      style={{
        'background-color':
          resolveColor(background(), tokens.colors) ?? background(),
        width: cssPx(size()),
        height: cssPx(size()),
        'border-width': cssPx(AVATAR_BORDER_WIDTH),
      }}
    >
      <Switch>
        <Match when={isNonEmpty(props.svg) ? props.svg : undefined}>
          {(svg) => (
            <img
              class={styles['image']}
              src={svgToDataUri(svg())}
              alt={props.alt ?? ''}
              width={size()}
              height={size()}
              draggable={false}
            />
          )}
        </Match>
        <Match when={isNonEmpty(props.uri) ? props.uri : undefined}>
          {(uri) => (
            <img
              class={styles['image']}
              src={uri()}
              alt={props.alt ?? ''}
              width={size()}
              height={size()}
            />
          )}
        </Match>
        <Match when={isNonEmpty(props.initials) ? props.initials : undefined}>
          {(initials) => (
            <p
              class="text font-bold"
              style={{
                color: foreground(),
                'font-size': `${Math.round(size() * 0.4)}px`,
              }}
            >
              {initials().slice(0, 2)}
            </p>
          )}
        </Match>
        <Match when={props.icon}>
          {(icon) => (
            <Dynamic
              component={icon()}
              size={Math.max(12, Math.round(size() * 0.48))}
              color={foreground()}
            />
          )}
        </Match>
      </Switch>
    </span>
  );
}
