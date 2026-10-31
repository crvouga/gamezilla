/** @jsxImportSource solid-js */

import {
  type Component,
  type JSX,
  type ParentProps,
  Show,
  untrack,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';

export type ProviderComponent = Component<ParentProps>;

export type ComposeProvidersProps = ParentProps<{
  /** Context providers to nest, listed outermost-first. */
  providers: readonly ProviderComponent[];
}>;

type NestProps = ParentProps<{
  providers: readonly ProviderComponent[];
  index: number;
}>;

function Nest(props: NestProps): JSX.Element {
  // The provider list is static composition config (like a component tree shape);
  // only `children` stays reactive.
  const providers = untrack(() => props.providers);
  const index = untrack(() => props.index);
  const Provider = providers[index];
  return (
    <Show when={Provider} fallback={props.children}>
      {(component) => (
        <Dynamic component={component()}>
          <Nest providers={providers} index={index + 1}>
            {props.children}
          </Nest>
        </Dynamic>
      )}
    </Show>
  );
}

/**
 * `ComposeProviders` -- nests context providers without deep JSX indentation.
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
export function ComposeProviders(props: ComposeProvidersProps): JSX.Element {
  return (
    <Nest providers={props.providers} index={0}>
      {props.children}
    </Nest>
  );
}
