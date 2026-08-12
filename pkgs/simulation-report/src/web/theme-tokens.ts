import type { CSSProperties } from 'react';

export const t = {
  bg: '#0a0b0d',
  panel: '#111318',
  panel2: '#161a21',
  border: '#2a303c',
  text: '#d7dde8',
  muted: '#7d8796',
  pass: '#3dd68c',
  fail: '#f07178',
  accent: '#82aaff',
  accentSoft: '#1a2333',
  control: '#1c222d',
  controlHover: '#262e3c',
  previewBg: '#070809',
  passBorder: '#1f6b4a',
  passBg: '#0d2a1c',
  failBorder: '#7a2e35',
  failBg: '#2a1215',
  primaryBorder: '#3a547a',
  headerH: 48,
  radius: 4,
  mono: '"IBM Plex Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

export function merge(
  ...parts: ReadonlyArray<CSSProperties | false | null | undefined>
): CSSProperties {
  const out: CSSProperties = { boxSizing: 'border-box' };
  for (const part of parts) {
    if (part) Object.assign(out, part);
  }
  return out;
}
