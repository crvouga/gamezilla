import { Button, Card, Stack, Text, useTheme } from '@gamezilla/shared/ui';
import { useCallback, useReducer, useRef } from 'react';
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

export function SimulatorLog({
  entries,
  onCopy,
}: {
  entries: LogEntry[];
  onCopy: () => void;
}) {
  const theme = useTheme();
  const copiedRef = useRef(false);
  const [, setTick] = useReducer((x: number) => x + 1, 0);

  const handleCopy = useCallback(() => {
    onCopy();
    copiedRef.current = true;
    setTick();
    setTimeout(() => {
      copiedRef.current = false;
      setTick();
    }, 1500);
  }, [onCopy]);

  return (
    <Card elevation={1} sx={{ p: 4, gap: 2 }}>
      <Stack direction="horizontal" align="center" justify="space-between">
        <Text
          variant="label"
          style={{ textTransform: 'uppercase', fontWeight: 'bold' }}
        >
          Log ({entries.length})
        </Text>
        <Button
          title={copiedRef.current ? 'Copied' : 'Copy for LLM'}
          variant="outlined"
          size="sm"
          onPress={handleCopy}
        />
      </Stack>

      {entries.length === 0 && (
        <Text variant="caption">No activity yet.</Text>
      )}

      <Stack spacing={0}>
        {entries.map((entry) => (
          <Stack
            key={entry.id}
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
            >
              {entry.id + 1}
            </Text>

            <Text
              variant="mono"
              style={{
                width: 76,
                fontSize: 10,
                fontWeight: '600',
                color: kindColor(entry),
              }}
              numberOfLines={1}
            >
              {kindLabel(entry)}
            </Text>

            <Text
              variant="mono"
              style={{
                width: 64,
                fontSize: 10,
                color: TAG_COLORS[entry.tag] ?? theme.colors.textSecondary,
              }}
              numberOfLines={1}
            >
              {entry.tag}
            </Text>

            {entry.peerId ? (
              <Text
                variant="mono"
                style={{
                  width: 64,
                  fontSize: 10,
                  color: entry.peerId === 'wire' ? '#facc15' : theme.colors.text,
                }}
                numberOfLines={1}
              >
                {entry.peerId}
              </Text>
            ) : (
              <Text
                variant="mono"
                style={{ width: 64, fontSize: 10, color: 'transparent' }}
              >
                {'-'}
              </Text>
            )}

            <Text
              variant="mono"
              style={{
                flex: 1,
                fontSize: 10,
                color: theme.colors.textSecondary,
              }}
              numberOfLines={2}
            >
              {entry.summary}
            </Text>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
