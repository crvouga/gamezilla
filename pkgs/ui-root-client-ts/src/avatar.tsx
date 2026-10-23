/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * `Avatar` -- circular avatar primitive.
 *
 * Renders the first content source provided, in priority order:
 *   `svg` > `uri` > `initials` > `icon` > the person placeholder.
 *
 * With no source it is the default face every big app draws: a filled head
 * and shoulders on a quiet plate, cropped by the circle. A person with no
 * picture is never an outlined icon sitting in a ring.
 *
 * Always round. By default a 1px hairline `border` ring keeps faces enclosed
 * on any surface (list rows, chrome, empty plates); `ring={false}` drops it
 * where a host already draws one. Outer diameter stays `size` (border-box);
 * content is clipped under the ring.
 *
 * `size` is a pixel diameter or a named step of {@link AVATAR_SIZES}
 * (`xs` 24, `sm` 32, `md` 40, `lg` 56, `xl` 96).
 *
 * Color props (`background`, `foreground`) take a theme color token name
 * (e.g. `'surfaceMuted'`, `'success'`, `'outline'`). Initials and icons sit
 * on the quiet `surfaceMuted` plate by default: blue is for what is chosen,
 * never a face.
 *
 * @example
 * ```tsx
 * <Avatar uri="https://example.com/photo.jpg" alt="Jane" size="md" />
 * <Avatar initials="JD" size={48} />
 * <Avatar svg={dicebearSvgString} size={64} />
 * <Avatar icon={Gamepad2Icon} size={48} background="surfaceMuted" />
 * <Avatar size={48} /> // nobody's picture yet: the person placeholder
 * ```
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { bestOnColor } from '@pkgs/ui-root-shared-ts/contrast';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import { svgToDataUri } from '@pkgs/ui-root-shared-ts/svg-data-uri';
import { createMemo, type JSX, Match, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import styles from './avatar.module.css';
import type { IconComponent } from './create-icon';
import { useThemeTokens } from './theme-context';

/** The named avatar diameters, on the 4px grid. */
export const AVATAR_SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
} as const;

export type AvatarSizeName = keyof typeof AVATAR_SIZES;

/** Diameter in px for a named step or a pixel size. */
export function avatarSizePx(
  size: number | AvatarSizeName | undefined
): number {
  if (size === undefined) return AVATAR_SIZES.md;
  return typeof size === 'number' ? size : AVATAR_SIZES[size];
}

const DEFAULT_BACKGROUND = 'surfaceMuted';

export type AvatarProps = {
  /** Diameter: pixels or a named step. Defaults to `md` (40). */
  size?: number | AvatarSizeName | undefined;
  /** Hairline `border` ring around the face. Defaults to `true`. */
  ring?: boolean | undefined;
  /**
   * Background color token. Defaults to the quiet `'surfaceMuted'` plate
   * behind initials, icons and the person placeholder.
   */
  background?: string | undefined;
  /**
   * Foreground (icon / initials / placeholder) color token. When
   * omitted it is auto-derived from `background` for a contrast-safe label in
   * both schemes; the placeholder instead sits one tone off its plate.
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
  /** Icon glyph for a plate that is not a person (a game, a device). */
  icon?: IconComponent | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Head and shoulders, drawn to the plate edge so the circle crops them. */
function PersonPlaceholder(props: {
  /** Set only for a caller-chosen `foreground`; the plate tone otherwise. */
  fill: string | undefined;
}): JSX.Element {
  return (
    <svg
      class={styles['placeholder']}
      style={props.fill !== undefined ? { fill: props.fill } : undefined}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <circle cx="20" cy="15.5" r="7.5" />
      <path d="M4.5 40c0-8.8 6.9-14.5 15.5-14.5S35.5 31.2 35.5 40z" />
    </svg>
  );
}

export function Avatar(props: AvatarProps): JSX.Element {
  const tokens = useThemeTokens();
  const size = () => avatarSizePx(props.size);
  const isPlaceholder = (): boolean =>
    !isNonEmpty(props.svg) &&
    !isNonEmpty(props.uri) &&
    !isNonEmpty(props.initials) &&
    props.icon === undefined;
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
      class="box inline-flex shrink-0 rounded-full border-border overflow-hidden items-center justify-center"
      classList={{ border: props.ring !== false }}
      {...dataAttrs({ component: 'Avatar', ...props.dataSet })}
      data-placeholder={isPlaceholder() ? 'true' : undefined}
      style={{
        'background-color':
          resolveColor(background(), tokens.colors) ?? background(),
        width: cssPx(size()),
        height: cssPx(size()),
      }}
    >
      <Switch
        fallback={
          <PersonPlaceholder
            fill={props.foreground !== undefined ? foreground() : undefined}
          />
        }
      >
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
              class="text font-semibold"
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
