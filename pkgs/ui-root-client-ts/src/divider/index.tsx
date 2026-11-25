/** @jsxImportSource @solidjs/web */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import { Separator } from '@ui-sdk/solid/separator';

export type DividerOrientation = 'horizontal' | 'vertical';

export type DividerProps = {
  /** Default `horizontal`. */
  orientation?: DividerOrientation | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

const ORIENTATION: Readonly<Record<DividerOrientation, string>> = {
  horizontal: 'box self-stretch h-px bg-border',
  vertical: 'box self-stretch w-px bg-border',
};

/**
 * `Divider` -- a hairline in the `border` color between two siblings of a
 * stack. `horizontal` (the default) separates items of a vertical stack,
 * `vertical` items of a horizontal one; it spans the stack's cross axis.
 *
 * It has no margin: the stack's `gap` is the space on either side. Rows of a
 * `List` / `MenuList` already draw their own hairlines.
 *
 * @example
 * ```tsx
 * <StackVertical gap="md">
 *   <Summary />
 *   <Divider />
 *   <Details />
 * </StackVertical>
 * ```
 */
export function Divider(props: DividerProps): JSX.Element {
  return (
    <Separator
      class={ORIENTATION[props.orientation ?? 'horizontal']}
      orientation={props.orientation ?? 'horizontal'}
      data-testid={props.testId}
      data-component={componentId('Divider')}
    />
  );
}
