/** @jsxImportSource solid-js */

import type { JSX } from 'solid-js';

const googleMark = new URL('./google-g.png', import.meta.url).href;

export type BrandIconSvgProps = {
  size: number;
};

/** Fixed-color vendor logos (vendor palettes; never theme-tinted). */
export function GoogleBrandLogo(props: BrandIconSvgProps): JSX.Element {
  return (
    <img
      src={googleMark}
      width={props.size}
      height={props.size}
      alt=""
      draggable={false}
    />
  );
}

export function DevIdpBrandLogo(props: BrandIconSvgProps): JSX.Element {
  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <circle cx="24" cy="18" r="8" fill="#6366F1" />
      <path fill="#6366F1" d="M8 44 C 8 33 15 28 24 28 C 33 28 40 33 40 44 Z" />
    </svg>
  );
}

/**
 * The Apple mark. Apple's guidelines draw it in the button's own text color
 * (black on white, white on black), so it is the one logo that follows
 * `currentColor` instead of fixing its palette.
 */
export function AppleBrandLogo(props: BrandIconSvgProps): JSX.Element {
  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}
