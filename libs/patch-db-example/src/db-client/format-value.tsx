import { Box, Collapsible, Text, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

const MAX_INLINE = 200;

export function formatAttrValue(value: unknown): string {
  // eslint-disable-next-line lingui/no-unlocalized-strings
  if (value === null) return 'null';
  // eslint-disable-next-line lingui/no-unlocalized-strings
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export type ValueKind = 'null' | 'bool' | 'number' | 'string' | 'object';

/* eslint-disable lingui/no-unlocalized-strings */
export function valueKind(value: unknown): ValueKind {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'object';
}
/* eslint-enable lingui/no-unlocalized-strings */

export function ValueKindBadge({ value }: { value: unknown }) {
  const { t } = useLingui();
  const theme = useTheme();
  const kind = valueKind(value);
  const label =
    kind === 'null'
      ? t`null`
      : kind === 'bool'
        ? t`bool`
        : kind === 'number'
          ? t`num`
          : kind === 'string'
            ? t`str`
            : t`obj`;
  const tone =
    kind === 'null'
      ? theme.colors.textSecondary
      : kind === 'bool'
        ? theme.colors.tint
        : kind === 'number'
          ? theme.colors.destructive
          : kind === 'string'
            ? theme.colors.tintMuted
            : theme.colors.icon;
  return (
    <Box
      sx={{
        px: 2,
        py: 0.5,
        borderRadius: 999,
        borderWidth: 1,
      }}
      style={{ borderColor: tone + '44', backgroundColor: tone + '12' }}
    >
      <Text
        variant="caption"
        style={{ fontSize: 10, color: tone, fontWeight: '600' }}
        label={label}
      />
    </Box>
  );
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

export function FormattedInlineValue({
  value,
  maxLen = MAX_INLINE,
}: {
  value: unknown;
  maxLen?: number;
}) {
  const theme = useTheme();
  const kind = valueKind(value);
  if (kind === 'object') {
    const raw = formatAttrValue(value);
    return (
      <Text
        variant="mono"
        style={{ fontSize: 12, color: theme.colors.text, flex: 1 }}
        label={truncate(raw, maxLen)}
      />
    );
  }
  const s = formatAttrValue(value);
  return (
    <Text
      variant="mono"
      style={{
        fontSize: 12,
        flex: 1,
        color: kind === 'null' ? theme.colors.textSecondary : theme.colors.text,
      }}
      label={truncate(s, maxLen)}
    />
  );
}

export function JsonCollapsible({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  const theme = useTheme();
  let pretty: string;
  try {
    pretty = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    pretty = String(value);
  }
  return (
    <Collapsible title={title} defaultOpen={pretty.length < 400}>
      <Box
        sx={{
          p: 3,
          borderRadius: 8,
          background: 'surface',
        }}
      >
        <Text
          variant="mono"
          style={{
            fontSize: 11,
            lineHeight: 16,
            color: theme.colors.text,
          }}
          label={pretty}
        />
      </Box>
    </Collapsible>
  );
}
