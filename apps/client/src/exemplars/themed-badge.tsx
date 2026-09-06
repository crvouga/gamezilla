/** @jsxImportSource solid-js */
import { Trans } from '@lingui/solid/macro';
import { useThemeScheme } from './theme-context';

/** Lazily-loaded consumer (see `exemplars-app.tsx`) to exercise `lazy` + `Suspense`. */
export default function ThemedBadge() {
  const theme = useThemeScheme();
  return (
    <span data-component="ThemedBadge" data-scheme={theme.scheme()}>
      <Trans>Current scheme: {theme.scheme()}</Trans>
    </span>
  );
}
