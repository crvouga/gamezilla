import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/@shared/theme';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

const typeStyles = {
  default: { fontSize: 16, lineHeight: 24, color: 'text' as const },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    color: 'text' as const,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    lineHeight: 32,
    color: 'text' as const,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: 'text' as const,
  },
  link: { lineHeight: 30, fontSize: 16, color: 'tint' as const },
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const baseStyle = theme.sx(typeStyles[type]);
  return <Text style={[baseStyle, style]} {...rest} />;
}
