/**
 * HeroUI Native `Checkbox` adapter.
 *
 * Translates the port API (`checked` / `onToggle` / `label` / `disabled`)
 * to HeroUI's `Checkbox` (`isSelected` / `onSelectedChange` / `isDisabled`)
 * inside a HeroUI `ControlField` so the label area is part of the
 * pressable hit target -- matching the in-house behavior where the whole
 * row toggles state.
 */

import {
  Checkbox as HeroUICheckbox,
  ControlField,
  Text as HeroUIText,
} from 'heroui-native';
import { View } from 'react-native';
import type { CheckboxProps } from '../../components/checkbox';

export function Checkbox({
  checked,
  onToggle,
  label,
  disabled = false,
}: CheckboxProps) {
  if (label === undefined) {
    return (
      <HeroUICheckbox
        isSelected={checked}
        onSelectedChange={onToggle}
        isDisabled={disabled}
      >
        <HeroUICheckbox.Indicator />
      </HeroUICheckbox>
    );
  }
  return (
    <ControlField
      isSelected={checked}
      onSelectedChange={onToggle}
      isDisabled={disabled}
    >
      <ControlField.Indicator>
        <HeroUICheckbox>
          <HeroUICheckbox.Indicator />
        </HeroUICheckbox>
      </ControlField.Indicator>
      <View style={{ flex: 1 }}>
        <HeroUIText>{label}</HeroUIText>
      </View>
    </ControlField>
  );
}
