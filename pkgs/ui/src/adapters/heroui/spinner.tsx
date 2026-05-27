/**
 * HeroUI Native `Spinner` adapter.
 *
 * Translates the port API (`'small' | 'medium' | 'large' | number`, `color`
 * as theme token name) to HeroUI's `Spinner` (`'sm' | 'md' | 'lg'`,
 * semantic color presets). Numeric sizes are mapped to the nearest preset
 * with `medium` as the fallback. Custom colors from our theme palette flow
 * through HeroUI's `color` prop which accepts a raw string fallback.
 */

import { Spinner as HeroUISpinner } from 'heroui-native';
import type { SpinnerProps } from '../../components/spinner';

type PortSpinnerSize = 'small' | 'medium' | 'large' | number;
type HeroUISpinnerSize = 'sm' | 'md' | 'lg';

function mapSize(size: PortSpinnerSize): HeroUISpinnerSize {
  if (typeof size === 'number') {
    if (size <= 28) return 'sm';
    if (size <= 40) return 'md';
    return 'lg';
  }
  switch (size) {
    case 'small':
      return 'sm';
    case 'medium':
      return 'md';
    case 'large':
      return 'lg';
  }
}

export function Spinner({ color = 'tint', size = 'medium' }: SpinnerProps) {
  return <HeroUISpinner size={mapSize(size)} color={color} />;
}
