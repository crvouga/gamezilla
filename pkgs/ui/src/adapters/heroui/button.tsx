/**
 * HeroUI Native `Button` adapter.
 *
 * Translates the port API (intent / size / loading / startIcon / endIcon /
 * title) to HeroUI's compound `Button` (`Button.Root` + `Button.Label`) with
 * its discriminated `variant` union. Loading state swaps the label for a
 * HeroUI `Spinner`; the outer pressable stays disabled while loading so
 * taps are ignored.
 *
 * Requires Uniwind + Tailwind v4 set up at the app level; HeroUI uses
 * `className` attrs internally that Uniwind resolves to RN styles at
 * runtime.
 */

import {
  Button as HeroUIButton,
  Spinner as HeroUISpinner,
} from 'heroui-native';
import { View } from 'react-native';
import type { ButtonIntent, ButtonProps } from '../../components/button';

type HeroUIButtonVariant = 'primary' | 'secondary' | 'danger';

function variantForIntent(intent: ButtonIntent): HeroUIButtonVariant {
  switch (intent) {
    case 'primary':
      return 'primary';
    case 'danger':
      return 'danger';
    case 'neutral':
      return 'secondary';
  }
}

function flexStyle(flex: number | undefined) {
  return flex === undefined ? undefined : { flex };
}

export function Button({
  title,
  onPress,
  intent = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  flex,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <HeroUIButton
      variant={variantForIntent(intent)}
      size={size}
      onPress={onPress}
      isDisabled={isDisabled}
      style={flexStyle(flex)}
    >
      {loading ? (
        <HeroUISpinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : (
        <>
          {startIcon !== undefined ? <View>{startIcon}</View> : null}
          <HeroUIButton.Label>{title}</HeroUIButton.Label>
          {endIcon !== undefined ? <View>{endIcon}</View> : null}
        </>
      )}
    </HeroUIButton>
  );
}
