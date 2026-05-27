/**
 * Port contract for `@pkgs/ui`.
 *
 * Adapters implement the `UIAdapter` interface; consumers never import from
 * `../adapters/**` directly -- they go through `@pkgs/ui` which re-exports
 * the active adapter's component identities once at module load.
 */

export type { UIAdapter, UiImpl } from './ui-adapter';
