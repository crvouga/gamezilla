/**
 * HeroUI Native `Chip` adapter.
 *
 * Translates port chip (`label` / `selected` / `onPress` / `disabled`) to
 * HeroUI's `Chip` (`variant` / `color` / `onPress` / `disabled`). Selected
 * state maps to `variant='primary' color='accent'`; unselected falls back
 * to `variant='soft' color='default'` to keep the quieter filter chip
 * aesthetic the in-house version has.
 */

import { Chip as HeroUIChip } from 'heroui-native';
import type { ChipProps } from '../../components/chip';

export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: ChipProps) {
  return (
    <HeroUIChip
      onPress={onPress}
      disabled={disabled}
      variant={selected ? 'primary' : 'soft'}
      color={selected ? 'accent' : 'default'}
      size="sm"
    >
      <HeroUIChip.Label>{label}</HeroUIChip.Label>
    </HeroUIChip>
  );
}
