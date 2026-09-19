// @pkgs/tailwind -- shared Tailwind CSS entry for the monorepo.
//
// Any Vite app (apps directory) gets Tailwind by:
//
//   1. Adding the `@tailwindcss/vite` plugin to its Vite config.
//   2. Importing `@pkgs/tailwind/tailwind.css` from its entry file.
//
// Utility classes in apps, libs, and pkgs sources are all scanned (see the
// `@source` directives in `tailwind.css`). Library code only writes class
// strings -- the app that bundles the CSS compiles them.
export const TAILWIND_CSS_SPECIFIER = '@pkgs/tailwind/tailwind.css';
