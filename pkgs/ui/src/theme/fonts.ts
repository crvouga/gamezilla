/**
 * Web font stacks. System fonts only — no webfont on the boot path
 * (see docs/low-end-android-perf.md, fonts budget).
 *
 * `display` / `rounded` are the playful face (wordmark, buttons, titles).
 * `sans` is body copy. They share one rounded stack today so the product
 * reads as a game; split them here if body copy ever needs a neutral face.
 * Emitted as `--ui-font-*` in `tokens.css`.
 */

const ROUNDED =
  'ui-rounded, "SF Pro Rounded", "Avenir Next", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export type FontStacks = {
  sans: string;
  serif: string;
  rounded: string;
  display: string;
  mono: string;
};

export const fonts: FontStacks = {
  sans: ROUNDED,
  serif:
    'ui-serif, Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif',
  rounded: ROUNDED,
  display: ROUNDED,
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};
