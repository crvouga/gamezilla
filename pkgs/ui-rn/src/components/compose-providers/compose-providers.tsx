/**
 * `ComposeProviders` -- nests React context providers without deep JSX indentation.
 *
 * Pass `providers` outermost-first; each entry must accept `{ children }`.
 * The last provider wraps the supplied `children` directly.
 *
 * @example
 * ```tsx
 * <ComposeProviders providers={[ThemeProvider, AuthProvider]}>
 *   <App />
 * </ComposeProviders>
 * ```
 */

import type { ComponentType, PropsWithChildren, ReactNode } from 'react';

export type ComposeProvidersProps = PropsWithChildren<{
  /** Context providers to nest, listed outermost-first. */
  providers: ComponentType<{ children: ReactNode }>[];
}>;

export function ComposeProviders(props: ComposeProvidersProps) {
  return props.providers.reduceRight(
    (acc, Provider) => <Provider>{acc}</Provider>,
    props.children
  );
}
