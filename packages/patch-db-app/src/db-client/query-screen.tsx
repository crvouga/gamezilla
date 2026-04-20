import type {
  PatchesDbQuery,
  PatchesDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import { usePatchesDb } from '@gamezilla/patch-db/react';
import {
  Button,
  Card,
  ScrollView,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/shared/ui';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

export type QueryScreenProps = {
  onClose?: () => void;
};

export function QueryScreen({ onClose }: QueryScreenProps) {
  const db = usePatchesDb();
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const scrollMaxHeight = Math.min(560, windowHeight * 0.72);
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [whereJson, setWhereJson] = useState('');
  const [limitStr, setLimitStr] = useState('50');
  const [offsetStr, setOffsetStr] = useState('0');
  const [mode, setMode] = useState<'entities' | 'patches'>('entities');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResultJson(null);
    try {
      const q: PatchesDbQuery = {
        on: mode,
      };
      const et = entityType.trim();
      if (et) q.entityType = et;
      const eid = entityId.trim();
      if (eid) q.entityId = eid;
      const lim = parseInt(limitStr, 10);
      if (!Number.isNaN(lim) && lim > 0) q.limit = lim;
      const off = parseInt(offsetStr, 10);
      if (!Number.isNaN(off) && off >= 0) q.offset = off;
      const w = whereJson.trim();
      if (w) {
        const parsed: unknown = JSON.parse(w);
        q.where = parsed as PatchesDbQueryWhereClause;
      }
      const results = await db.read([q]);
      setResultJson(JSON.stringify(results, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <ScrollView
      sx={{ flex: 1 }}
      style={{ maxHeight: scrollMaxHeight }}
      contentContainerStyle={{ padding: 16 }}
    >
      <Stack spacing={3}>
        {onClose !== undefined ? (
          <Button title="Close" variant="ghost" size="sm" onPressIn={onClose} />
        ) : null}

        <SegmentedControl
          segments={[
            { key: 'entities', label: 'entities' },
            { key: 'patches', label: 'patches' },
          ]}
          selected={mode}
          onSelect={(k) => setMode(k as 'entities' | 'patches')}
        />

        <Card elevation={1} sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Text variant="bodyBold" label="Query" />
            <TextInput
              value={entityType}
              onChangeText={setEntityType}
              placeholder="entityType (optional)"
              autoCapitalize="none"
              sx={{
                borderWidth: 1,
                borderRadius: 8,
                px: 3,
                py: 2,
                fontSize: 14,
                background: 'paper',
                borderColor: 'border',
              }}
            />
            <TextInput
              value={entityId}
              onChangeText={setEntityId}
              placeholder="entityId (optional)"
              autoCapitalize="none"
              sx={{
                borderWidth: 1,
                borderRadius: 8,
                px: 3,
                py: 2,
                fontSize: 14,
                background: 'paper',
                borderColor: 'border',
              }}
            />
            <TextInput
              value={limitStr}
              onChangeText={setLimitStr}
              placeholder="limit"
              keyboardType="number-pad"
              sx={{
                borderWidth: 1,
                borderRadius: 8,
                px: 3,
                py: 2,
                fontSize: 14,
                background: 'paper',
                borderColor: 'border',
              }}
            />
            <TextInput
              value={offsetStr}
              onChangeText={setOffsetStr}
              placeholder="offset"
              keyboardType="number-pad"
              sx={{
                borderWidth: 1,
                borderRadius: 8,
                px: 3,
                py: 2,
                fontSize: 14,
                background: 'paper',
                borderColor: 'border',
              }}
            />
            <Text variant="caption" label="where (JSON, optional)" />
            <TextInput
              value={whereJson}
              onChangeText={setWhereJson}
              placeholder='e.g. {"type":"=","attribute":"todo/title","value":"x"}'
              multiline
              sx={{
                borderWidth: 1,
                borderRadius: 8,
                px: 3,
                py: 2,
                fontSize: 12,
                minHeight: 100,
                background: 'paper',
                borderColor: 'border',
                fontFamily: 'monospace',
              }}
            />
            <Button
              title={running ? 'Running…' : 'Run read([query])'}
              variant="solid"
              onPressIn={() => void run()}
            />
          </Stack>
        </Card>

        {error !== null ? (
          <Card
            elevation={0}
            sx={{ p: 3 }}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.destructive + '44',
              backgroundColor: theme.colors.destructive + '0a',
            }}
          >
            <Text
              variant="mono"
              style={{ fontSize: 12, color: theme.colors.destructive }}
              label={error}
            />
          </Card>
        ) : null}

        {resultJson !== null ? (
          <Card elevation={1} sx={{ p: 3 }}>
            <Text variant="bodyBold" label="Result" />
            <Text
              variant="mono"
              style={{
                fontSize: 11,
                marginTop: 8,
                lineHeight: 16,
                color: theme.colors.text,
              }}
              label={resultJson}
            />
          </Card>
        ) : null}
      </Stack>
    </ScrollView>
  );
}
