import { Stack, Text, useTheme } from '@gamezilla/lib/ui';
import type { LogEntry } from '../simulator/playground';

const TAG_COLORS: Record<string, string> = {
  dispatch: '#7dd3fc',
  disconnect: '#fca5a5',
  reconnect: '#6ee7b7',
  network: '#a5b4fc',
  cheat: '#f472b6',
  committed: '#6ee7b7',
};

function kindLabel(entry: LogEntry): string {
  if (entry.kind === 'cheat') {
    return entry.detected ? 'CAUGHT' : 'UNDETECTED';
  }
  return entry.kind.toUpperCase();
}

function kindColor(entry: LogEntry): string {
  if (entry.kind === 'cheat') {
    return entry.detected ? '#6ee7b7' : '#fca5a5';
  }
  if (entry.kind === 'effect') return '#a5b4fc';
  return '#e2e8f0';
}

function PeerCell({ peerId }: { peerId: string | undefined }) {
  const theme = useTheme();
  if (!peerId) {
    return (
      <Text
        variant="mono"
        style={{ width: 64, fontSize: 10, color: 'transparent' }}
        label="-"
      />
    );
  }
  const color = peerId === 'wire' ? '#facc15' : theme.colors.text;
  return (
    <Text
      variant="mono"
      style={{ width: 64, fontSize: 10, color }}
      numberOfLines={1}
      label={peerId}
    />
  );
}

export function SimulatorLogRow({ entry }: { entry: LogEntry }) {
  const theme = useTheme();
  const tagColor = TAG_COLORS[entry.tag] ?? theme.colors.textSecondary;

  return (
    <Stack
      direction="horizontal"
      spacing={2}
      align="flex-start"
      sx={{ py: 0.5 }}
    >
      <Text
        variant="mono"
        style={{
          width: 24,
          textAlign: 'right',
          fontSize: 10,
          color: theme.colors.textSecondary,
        }}
        label={String(entry.id + 1)}
      />
      <Text
        variant="mono"
        style={{
          width: 76,
          fontSize: 10,
          fontWeight: '600',
          color: kindColor(entry),
        }}
        numberOfLines={1}
        label={kindLabel(entry)}
      />
      <Text
        variant="mono"
        style={{ width: 64, fontSize: 10, color: tagColor }}
        numberOfLines={1}
        label={entry.tag}
      />
      <PeerCell peerId={entry.peerId} />
      <Text
        variant="mono"
        style={{
          flex: 1,
          fontSize: 10,
          color: theme.colors.textSecondary,
        }}
        numberOfLines={2}
        label={entry.summary}
      />
    </Stack>
  );
}
