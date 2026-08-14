import type { SxProps } from '@pkgs/ui';

/**
 * Console palette — the report viewer keeps its own dark, monospace chrome
 * rather than the product theme. Values are raw hex strings passed straight
 * through `sx` (which accepts arbitrary color strings).
 */
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

/** Full-height shell: fixed header row + flexible body. */
export const appShellSx: SxProps = {
  flex: 1,
  flexDirection: 'column',
  backgroundColor: t.bg,
};

/** Fixed top bar — identical on buckets / runs / suite / player. */
export const appHeaderSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingHorizontal: 12,
  height: t.headerH,
  borderBottomWidth: 1,
  borderBottomColor: t.border,
  backgroundColor: t.panel,
};

export const appHeaderTrailingSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
};

/** Scroll frame + content for list/table screens. */
export const appBodyFrameSx: SxProps = { flex: 1, backgroundColor: t.bg };
export const appBodyContentSx: SxProps = {
  paddingHorizontal: 28,
  paddingTop: 24,
  paddingBottom: 40,
  gap: 16,
};

export const emptySx: SxProps = { color: t.muted, padding: 24 };
export const metaSx: SxProps = { color: t.muted, fontSize: 12 };
export const testIdSx: SxProps = { fontWeight: '600', color: t.accent };

export const thSx: SxProps = {
  color: t.muted,
  fontWeight: '500',
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontSize: 10,
};

export const rowSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
  paddingHorizontal: 12,
  gap: 12,
  borderBottomWidth: 1,
  borderBottomColor: t.border,
};

export const cellTextSx: SxProps = { color: t.text, fontSize: 12 };

export const badgeBaseSx: SxProps = {
  alignSelf: 'flex-start',
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 1,
  borderRadius: 2,
  fontSize: 11,
  fontWeight: '600',
  letterSpacing: 0.4,
  borderWidth: 1,
  borderColor: t.border,
  backgroundColor: t.panel,
  color: t.text,
};

/** Status badge tint (passed / failed / neutral). */
export function badgeSx(status: string): SxProps {
  if (status === 'passed') {
    return {
      ...badgeBaseSx,
      color: t.pass,
      borderColor: t.passBorder,
      backgroundColor: t.passBg,
    };
  }
  if (status === 'failed') {
    return {
      ...badgeBaseSx,
      color: t.fail,
      borderColor: t.failBorder,
      backgroundColor: t.failBg,
    };
  }
  return badgeBaseSx;
}

export const btnSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: t.border,
  backgroundColor: t.control,
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: t.radius,
};

export const btnTextSx: SxProps = { color: t.text, fontSize: 12 };
export const btnDisabledSx: SxProps = { opacity: 0.45 };

export const btnPrimarySx: SxProps = {
  ...btnSx,
  borderColor: t.primaryBorder,
  backgroundColor: t.accentSoft,
};
export const btnPrimaryTextSx: SxProps = { color: t.accent, fontSize: 12 };

/** Rounded transport / icon buttons. */
export const iconBtnSx: SxProps = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  borderWidth: 1,
  borderColor: t.border,
  backgroundColor: t.control,
  borderRadius: 9999,
};
export const iconBtnPrimarySx: SxProps = {
  borderColor: t.primaryBorder,
  backgroundColor: t.accentSoft,
};
export const iconBtnSmSx: SxProps = { height: 30, minWidth: 30, paddingHorizontal: 10 };
export const iconBtnMdSx: SxProps = { width: 34, height: 34 };
export const iconBtnDisabledSx: SxProps = { opacity: 0.4 };

/** Detail/preview panes. */
export const paneSx: SxProps = {
  flex: 1,
  flexDirection: 'column',
  backgroundColor: t.bg,
};
