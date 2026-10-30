/** @jsxImportSource solid-js */

import { svgToDataUri } from '@pkgs/ui-root-shared-ts/svg-data-uri';
import { type JSX, Match, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import styles from '../avatar/avatar.module.css';
import type { IconComponent } from '../create-icon/index';
import { BotIcon } from '../icons';

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
    props.bot ? BotIcon : props.icon;
  return (
    <Switch fallback={<PersonPlaceholder fill={props.placeholderFill} />}>
      <Match when={props.bot ? undefined : props.svg}>
        {(svg) => (
          <img
            class={styles['image']}
            src={svgToDataUri(svg())}
            alt=""
            width={props.size}
            height={props.size}
            draggable={false}
          />
        )}
      </Match>
      <Match when={props.bot ? undefined : props.uri}>
        {(uri) => (
          <img
            class={styles['image']}
            src={uri()}
            alt=""
            width={props.size}
            height={props.size}
          />
        )}
      </Match>
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
        {(glyph) => (
          <Dynamic
            component={glyph()}
            size={glyphSize(props.size)}
            color={props.color}
          />
        )}
      </Match>
    </Switch>
  );
}
