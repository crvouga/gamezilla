/** @jsxImportSource @solidjs/web */

import { svgToDataUri } from '@pkgs/ui-root-shared-ts/svg-data-uri';
import { dynamic, type JSX } from '@solidjs/web';
import { AvatarFallback, AvatarImage } from '@ui-sdk/solid/avatar';
import { Match, Show, Switch } from 'solid-js';
import styles from '../avatar/avatar.module.css';
import type { IconComponent } from '../create-icon/index';
import { MascotPortrait } from '../mascot-portrait/index';

export type AvatarFaceProps = {
  /** Draw the bot glyph whatever the other sources are. */
  bot: boolean;
  size: number;
  svg: string | undefined;
  uri: string | undefined;
  initials: string | undefined;
  icon: IconComponent | undefined;
  /** Resolved ink for initials and glyphs. */
  color: string;
  /** Set only for a chosen ink; the placeholder sits on its plate tone otherwise. */
  placeholderFill: string | undefined;
};

/** Head and shoulders, drawn to the plate edge so the circle crops them. */
function PersonPlaceholder(props: { fill: string | undefined }): JSX.Element {
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

function glyphSize(size: number): number {
  return Math.max(12, Math.round(size * 0.48));
}

/**
 * What fills an `Avatar`'s circle: a picture, initials, a glyph, the bot, or
 * the person placeholder. Design-system internal; `Avatar` owns the plate,
 * the ring, the kind and the accessible name, so every face here is
 * decorative.
 */
export function AvatarFace(props: AvatarFaceProps): JSX.Element {
  const icon = (): IconComponent | undefined =>
    props.bot ? MascotPortrait : props.icon;
  const Glyph = dynamic(icon);
  const image = (): string | undefined => {
    if (props.bot) return undefined;
    return props.svg === undefined ? props.uri : svgToDataUri(props.svg);
  };
  return (
    <>
      <Show when={image()}>
        {(src) => (
          <AvatarImage
            class={styles['image']}
            src={src()}
            alt=""
            width={props.size}
            height={props.size}
            draggable={props.svg === undefined ? undefined : 'false'}
          />
        )}
      </Show>
      <AvatarFallback
        class="box size-full items-center justify-center"
        aria-hidden="true"
      >
        <Switch fallback={<PersonPlaceholder fill={props.placeholderFill} />}>
          <Match when={props.bot ? undefined : props.initials}>
            {(initials) => (
              <span
                class="text font-semibold"
                aria-hidden="true"
                style={{
                  color: props.color,
                  'font-size': `${Math.round(props.size * 0.4)}px`,
                }}
              >
                {initials().slice(0, 2)}
              </span>
            )}
          </Match>
          <Match when={icon()}>
            <Glyph
              size={props.bot ? props.size : glyphSize(props.size)}
              color={props.color}
            />
          </Match>
        </Switch>
      </AvatarFallback>
    </>
  );
}
