/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { bestOnColor } from '@pkgs/ui-root-shared-ts/contrast';
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';
import { resolveColor } from '@pkgs/ui-root-shared-ts/resolve-color';
import { createMemo, type JSX, Show } from 'solid-js';
import { AvatarFace } from '../avatar-face/index';
import type { IconComponent } from '../create-icon/index';
import { UserIcon } from '../icons';
import { useThemeTokens } from '../theme-context/index';

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

/** Who holds the place the avatar shows. */
export type AvatarKind = 'person' | 'bot' | 'guest' | 'emptySeat';

/** The seat colors a game may give its places, in seat order. */
export const AVATAR_SEAT_COLORS = [
  'player1',
  'player2',
  'player3',
  'player4',
  'player5',
  'player6',
  'player7',
  'player8',
] as const satisfies readonly ColorTokenName[];

export type AvatarSeatColor = (typeof AVATAR_SEAT_COLORS)[number];

const SEAT_RING: Readonly<Record<AvatarSeatColor, string>> = {
  player1: 'border-player1',
  player2: 'border-player2',
  player3: 'border-player3',
  player4: 'border-player4',
  player5: 'border-player5',
  player6: 'border-player6',
  player7: 'border-player7',
  player8: 'border-player8',
};

const QUIET_PLATE = 'surfaceMuted';
const YOUR_PLATE = 'tintSubtle';
const YOUR_INK = 'onPrimarySoft';
const BOT_INK = 'icon';

export type AvatarProps = {
  /** Who holds the place. Defaults to `person`. */
  kind?: AvatarKind | undefined;
  /** The person's own face: the soft tint plate and ink. */
  you?: boolean | undefined;
  /** The seat's player color, drawn as the ring. */
  seatColor?: AvatarSeatColor | undefined;
  /** Diameter: pixels or a named step. Defaults to `md` (40). */
  size?: number | AvatarSizeName | undefined;
  /** Hairline `border` ring around the face. Defaults to `true`. */
  ring?: boolean | undefined;
  /**
   * Background color token. Defaults to the quiet `'surfaceMuted'` plate
   * (`'tintSubtle'` for `you`). Not used by an empty seat.
   */
  background?: string | undefined;
  /**
   * Foreground (icon / initials / placeholder) color token. When omitted it
   * is auto-derived from `background` for a contrast-safe label in both
   * schemes; the placeholder instead sits one tone off its plate.
   */
  foreground?: string | undefined;
  /**
   * Raw SVG XML string (e.g. from a generative avatar library such as
   * DiceBear). Highest-priority content source. Trusted markup only.
   */
  svg?: string | null | undefined;
  /** Image URL to render inside the circle. */
  uri?: string | undefined;
  /**
   * Accessible name: who this is. A bot, guest or empty seat adds its kind
   * (and has a name without one); a person without `alt` is decorative.
   */
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

/** The ring: the seat color, the empty seat's dashes, or the hairline. */
function ringClass(
  avatar: Pick<AvatarProps, 'kind' | 'seatColor' | 'ring'>
): string {
  const dashed = avatar.kind === 'emptySeat' ? ' border-dashed' : '';
  if (avatar.seatColor !== undefined) {
    return `border-2 ${SEAT_RING[avatar.seatColor]}${dashed}`;
  }
  if (avatar.kind === 'emptySeat') {
    return 'border-2 border-dashed border-outline';
  }
  return avatar.ring === false ? '' : 'border border-border';
}

/** The name the avatar is announced by, or `undefined` when decorative. */
function useAvatarName(props: AvatarProps): () => string | undefined {
  const { t } = useLingui();
  return () => {
    const alt = isNonEmpty(props.alt) ? props.alt : undefined;
    if (props.kind === 'bot') {
      return alt === undefined ? t`Bot` : t`${alt}, bot`;
    }
    if (props.kind === 'guest') {
      return alt === undefined ? t`Guest` : t`${alt}, guest`;
    }
    if (props.kind === 'emptySeat') return alt ?? t`Open seat`;
    return alt;
  };
}

/** The small mark at a guest's lower end. */
function GuestMark(props: { size: number }): JSX.Element {
  const diameter = (): number =>
    Math.max(12, Math.round((props.size * 0.4) / 4) * 4);
  return (
    <span
      class="box absolute right-0 bottom-0 rounded-full border border-border bg-surface items-center justify-center"
      data-avatar-mark="guest"
      style={{ width: cssPx(diameter()), height: cssPx(diameter()) }}
    >
      <UserIcon size={Math.round(diameter() * 0.7)} color="textSecondary" />
    </span>
  );
}

/**
 * `Avatar` -- the round face of whoever (or whatever) holds a place.
 *
 * Four kinds, so nobody draws their own:
 * - `person` (default): their picture, else their initials, else the person
 *   placeholder -- a filled head and shoulders on a quiet plate, cropped by
 *   the circle. A person with no picture is never an outlined icon in a ring.
 * - `bot`: the bot glyph on the quiet plate, never a person.
 * - `guest`: a person's face (usually the placeholder) with a small guest
 *   mark at its lower end.
 * - `emptySeat`: an open seat -- a dashed `outline` ring and nobody in it.
 *
 * Bots, guests and empty seats always carry an accessible name (`Bot`,
 * `Guest`, `Open seat`, or `alt` with the kind added); a person is named by
 * `alt` and is decorative without it.
 *
 * `you` marks the person's own face: the `tintSubtle` plate with initials
 * (or the placeholder) in `onPrimarySoft`. `seatColor` draws the seat's
 * player color (`player1`..`player8`) as the ring, when a game supplies one.
 *
 * Always round. By default a 1px hairline `border` ring keeps faces enclosed
 * on any surface; `ring={false}` drops it where a host already draws one.
 * Outer diameter stays `size` (border-box); the face is clipped inside the
 * ring. Source priority for a person: `svg` > `uri` > `initials` > `icon` >
 * the placeholder. `icon` is for a plate that is not a person: a game, a
 * device.
 *
 * @example
 * ```tsx
 * <Avatar uri={photo} alt="Jane" size="md" />
 * <Avatar initials="JD" you />
 * <Avatar kind="bot" alt="Stockfish" seatColor="player2" />
 * <Avatar kind="guest" />
 * <Avatar kind="emptySeat" />
 * ```
 */
export function Avatar(props: AvatarProps): JSX.Element {
  const tokens = useThemeTokens();
  const name = useAvatarName(props);
  const size = () => avatarSizePx(props.size);
  const kind = (): AvatarKind => props.kind ?? 'person';
  const isPlaceholder = (): boolean =>
    (kind() === 'person' || kind() === 'guest') &&
    !isNonEmpty(props.svg) &&
    !isNonEmpty(props.uri) &&
    !isNonEmpty(props.initials) &&
    props.icon === undefined;
  const background = (): string =>
    props.background ?? (props.you === true ? YOUR_PLATE : QUIET_PLATE);
  const ink = (): string | undefined =>
    props.foreground ??
    (props.you === true ? YOUR_INK : kind() === 'bot' ? BOT_INK : undefined);
  const foreground = createMemo((): string => {
    const chosen = ink();
    if (chosen !== undefined) {
      return resolveColor(chosen, tokens.colors) ?? chosen;
    }
    const raw = resolveColor(background(), tokens.palette()) ?? background();
    return bestOnColor(raw).fg;
  });
  return (
    <span
      class={`box inline-flex shrink-0 rounded-full items-center justify-center ${ringClass({ kind: props.kind, seatColor: props.seatColor, ring: props.ring })}`}
      {...dataAttrs({ component: 'Avatar', ...props.dataSet })}
      data-kind={kind()}
      data-you={props.you === true ? 'true' : undefined}
      data-seat-color={props.seatColor}
      data-placeholder={isPlaceholder() ? 'true' : undefined}
      role={name() === undefined ? undefined : 'img'}
      aria-label={name()}
      style={{
        'background-color':
          kind() === 'emptySeat'
            ? undefined
            : (resolveColor(background(), tokens.colors) ?? background()),
        width: cssPx(size()),
        height: cssPx(size()),
      }}
    >
      <Show when={kind() !== 'emptySeat'}>
        <AvatarFace
          bot={kind() === 'bot'}
          size={size()}
          svg={isNonEmpty(props.svg) ? props.svg : undefined}
          uri={isNonEmpty(props.uri) ? props.uri : undefined}
          initials={isNonEmpty(props.initials) ? props.initials : undefined}
          icon={props.icon}
          color={foreground()}
          placeholderFill={ink() === undefined ? undefined : foreground()}
        />
      </Show>
      <Show when={kind() === 'guest'}>
        <GuestMark size={size()} />
      </Show>
    </span>
  );
}
