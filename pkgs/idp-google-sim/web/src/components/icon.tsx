/**
 * The handful of glyphs the screens need, drawn inline.
 *
 * The design system's icon boundary (`@pkgs/ui`) is deliberately not used here:
 * `createIcon` reads `@pkgs/ui`'s theme context and throws without
 * `ThemeProvider`, and that provider installs Gamezilla's token map — the one
 * thing a Google-branded page must not inherit. Each glyph is a few stroke
 * commands in `currentColor`, so nothing is vendored and nothing is themed.
 */

export type IconName =
  | 'alert'
  | 'back'
  | 'eye'
  | 'eye-off'
  | 'globe'
  | 'info'
  | 'mail'
  | 'plus'
  | 'user'
  | 'user-plus';

const GLYPHS: Record<IconName, readonly string[]> = {
  alert: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 8v4', 'M12 16h.01'],
  back: ['M15 18l-6-6 6-6'],
  eye: [
    'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  ],
  'eye-off': [
    'M4 4l16 16',
    'M10.6 6.2A9.6 9.6 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.4 4',
    'M6.3 8.3A17 17 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4-.8',
  ],
  globe: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
    'M3 12h18',
    'M12 3c2.5 2.7 2.5 15.3 0 18',
    'M12 3c-2.5 2.7-2.5 15.3 0 18',
  ],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 11v5', 'M12 8h.01'],
  mail: ['M3 6h18v12H3z', 'M3 7l9 6 9-6'],
  plus: ['M12 5v14', 'M5 12h14'],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  ],
  'user-plus': [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M19 8v6',
    'M22 11h-6',
  ],
};

export function Icon(props: {
  readonly name: IconName;
  readonly class?: string | undefined;
}) {
  return (
    <svg
      class={props.class}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[props.name].map((d) => (
        <path d={d} />
      ))}
    </svg>
  );
}
