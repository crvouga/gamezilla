import { Button, Card, Stack, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useReducer, useRef } from 'react';
import type { LogEntry } from '../simulator/playground';
import { SimulatorLogRow } from './simulator-log-row';

export function SimulatorLog({
  entries,
  onCopy,
}: {
  entries: LogEntry[];
  onCopy: () => void;
}) {
  const { t } = useLingui();
  const entryCount = entries.length;
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
          label={t`Log (${entryCount})`}
        />
        <Button
          title={copiedRef.current ? t`Copied` : t`Copy for LLM`}
          variant="outlined"
          size="sm"
          onPress={handleCopy}
        />
      </Stack>

      {entries.length === 0 && (
        <Text variant="caption" label={t`No activity yet.`} />
      )}

      <Stack spacing={0}>
        {entries.map((entry) => (
          <SimulatorLogRow key={entry.id} entry={entry} />
        ))}
      </Stack>
    </Card>
  );
}
