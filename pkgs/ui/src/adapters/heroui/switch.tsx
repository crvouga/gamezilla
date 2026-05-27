/**
 * HeroUI Native `Switch` adapter.
 *
 * Maps the port API (`value` / `onValueChange` / `disabled` / `label`) to
 * HeroUI's `Switch` (`isSelected` / `onSelectedChange` / `isDisabled`) and
 * adopts our existing label layout via the port `Text` component (which
 * itself comes from the adapter, so the label automatically inherits
 * whichever adapter is active).
 */

import { Switch as HeroUISwitch, Text as HeroUIText } from 'heroui-native';
import { View } from 'react-native';
import type { SwitchProps } from '../../components/switch';

export function Switch({
  value,
  onValueChange,
  disabled,
  label,
  ...rest
}: SwitchProps) {
  const onSelectedChangeProp =
    onValueChange === undefined || onValueChange === null
      ? {}
      : {
          onSelectedChange: (next: boolean): void => {
            void onValueChange(next);
          },
        };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <HeroUISwitch
        isSelected={value ?? false}
        isDisabled={disabled ?? false}
        accessibilityLabel={rest.accessibilityLabel}
        testID={rest.testID}
        {...onSelectedChangeProp}
      >
        <HeroUISwitch.Thumb />
      </HeroUISwitch>
      {label !== undefined ? <HeroUIText>{label}</HeroUIText> : null}
    </View>
  );
}
