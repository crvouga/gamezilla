/**
 * HeroUI Native `Divider` adapter -- maps to HeroUI's `Separator`.
 *
 * Both render a hairline line separating content. The port keeps the
 * "Divider" name for backwards compatibility with consumers; the heroui
 * adapter routes through HeroUI's `Separator` which derives its color from
 * the `--separator` CSS variable supplied by `heroui-native/styles`.
 */

import { Separator } from 'heroui-native';
import type { DividerProps } from '../../components/divider';

export function Divider({
  orientation = 'horizontal',
  style,
  ...rest
}: DividerProps) {
  return (
    <Separator
      orientation={orientation}
      variant="thin"
      style={style}
      {...rest}
    />
  );
}
