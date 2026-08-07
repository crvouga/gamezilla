/**
 * Canonical title text for {@link TopBar} center slots and
 * {@link ScreenBaseHeader} breadcrumbs.
 */

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { SxProps } from '../../theme';
import { Text, type TextVariant } from '../text';

export type TopBarTitleProps = {
  label: ReactNode;
};

type VariantTitleElement = ReactElement<{
  variant?: TextVariant;
  numberOfLines?: number;
  sx?: SxProps;
}>;

function isVariantTitleElement(label: ReactNode): label is VariantTitleElement {
  return (
    isValidElement(label) &&
    typeof label.props === 'object' &&
    label.props !== null &&
    'variant' in label.props
  );
}

function renderVariantTitleElement(label: VariantTitleElement): ReactNode {
  return cloneElement(label, {
    variant: 'navigationTitle',
    numberOfLines: label.props.numberOfLines ?? 1,
    sx: { textAlign: 'center', ...label.props.sx },
  });
}

export function TopBarTitle({ label }: TopBarTitleProps): ReactNode {
  if (isVariantTitleElement(label)) {
    return renderVariantTitleElement(label);
  }

  return (
    <Text
      accessibilityRole="header"
      aria-level={1}
      numberOfLines={1}
      ellipsizeMode="tail"
      variant="navigationTitle"
      sx={{ textAlign: 'center' }}
      label={label}
    />
  );
}
