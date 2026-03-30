import { View, type ViewProps } from 'react-native';

import { useTheme } from '@gamezilla/shared/theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();
  const baseStyle = theme.sx({ background: 'paper' });
  return <View style={[baseStyle, style]} {...otherProps} />;
}
