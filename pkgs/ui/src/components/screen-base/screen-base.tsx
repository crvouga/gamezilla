/** @jsxImportSource solid-js */
/**
 * `ScreenBase` -- full screen shell: header + body. Dispatches to compact
 * (mobile / tablet `TopBar` shell) or wide (desktop island header + card
 * body) via `useLayoutMode`. Requires `screenId`, rendered as `data-screen`.
 *
 * @example
 * ```tsx
 * <ScreenBase
 *   screenId="settings"
 *   breadcrumbs={[{ name: 'Home', href: '/' }, { name: 'Settings' }]}
 *   actions={[{ type: 'submit', label: 'Save', onClick: save }]}
 *   scroll
 *   content={({ bodyClass }) => <div class={bodyClass}>…</div>}
 * />
 * ```
 */

import { type JSX, Show } from 'solid-js';
import { useLayoutMode } from '../../theme';
import { ScreenBaseCompact } from './screen-base-compact';
import type { ScreenBaseProps } from './screen-base-types';
import { ScreenBaseWide } from './screen-base-wide';

export function ScreenBase(props: ScreenBaseProps): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show when={mode() === 'wide'} fallback={<ScreenBaseCompact {...props} />}>
      <ScreenBaseWide {...props} />
    </Show>
  );
}
