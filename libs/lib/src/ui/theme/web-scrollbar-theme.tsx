/**
 * Web-only: inject a `<style>` tag so browser scrollbars (plus native form
 * controls via `color-scheme`) follow the current theme palette. No-op on
 * native platforms.
 */

import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { ColorTokens, ColorScheme } from './colors';
import { useTheme } from './theme-context';

const STYLE_ELEMENT_ID = 'gamezilla-theme-scrollbar';

function buildScrollbarCss(
  colorScheme: ColorScheme,
  colors: ColorTokens,
): string {
  const track = 'transparent';
  const thumb = colors.tintMuted;
  const thumbHover = colors.tint;

  return `
:root {
  color-scheme: ${colorScheme};
  scrollbar-color: ${thumb} ${track};
  scrollbar-width: thin;
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
  background-color: ${track};
}

*::-webkit-scrollbar-track {
  background-color: ${track};
}

*::-webkit-scrollbar-thumb {
  background-color: ${thumb};
  border-radius: 9999px;
  border: 2px solid ${track};
  background-clip: padding-box;
}

*::-webkit-scrollbar-thumb:hover {
  background-color: ${thumbHover};
}

*::-webkit-scrollbar-thumb:active {
  background-color: ${thumbHover};
}

*::-webkit-scrollbar-corner {
  background-color: ${track};
}
`;
}

export function WebScrollbarTheme() {
  const { colors, colorScheme } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }

    let style = document.getElementById(STYLE_ELEMENT_ID);
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement('style');
      style.id = STYLE_ELEMENT_ID;
      document.head.appendChild(style);
    }
    style.textContent = buildScrollbarCss(colorScheme, colors);
  }, [colors, colorScheme]);

  return null;
}
