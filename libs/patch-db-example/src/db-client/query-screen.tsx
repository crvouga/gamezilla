import {
  Button,
  Card,
  ScrollView,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  useTheme,
} from '@gamezilla/lib/ui';
import type {
  PatchDbQuery,
  PatchDbQueryWhereClause,
} from '@gamezilla/patch-db/interface';
import { usePatchDb } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { TodoAttr } from '../todo/domain/todo-constants';

export type QueryScreenProps = {
  onClose?: () => void;
};

const INPUT_SX = {
  borderWidth: 1,
  borderRadius: 8,
  px: 3,
  py: 2,
  fontSize: 14,
  background: 'surface',
  borderColor: 'border',
} as const;

const WHERE_JSON_INPUT_SX = {
  borderWidth: 1,
  borderRadius: 8,
  px: 3,
  py: 2,
  fontSize: 12,
  minHeight: 100,
  background: 'surface',
  borderColor: 'border',
  fontFamily: 'monospace',
} as const;

function WhereJsonTextInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={
        `e.g. {"type":"=","attribute":"${TodoAttr.title.key}","value":"x"}` as never
      }
      multiline
      sx={WHERE_JSON_INPUT_SX}
    />
  );
}

type QueryFormState = {
  entityType: string;
  setEntityType: (v: string) => void;
  entityId: string;
  setEntityId: (v: string) => void;
  whereJson: string;
  setWhereJson: (v: string) => void;
  limitStr: string;
  setLimitStr: (v: string) => void;
  offsetStr: string;
  setOffsetStr: (v: string) => void;
  mode: 'entities' | 'patches';
  setMode: (m: 'entities' | 'patches') => void;
};

function useQueryFormState(): QueryFormState {
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [whereJson, setWhereJson] = useState('');
  const [limitStr, setLimitStr] = useState('50');
  const [offsetStr, setOffsetStr] = useState('0');
  const [mode, setMode] = useState<'entities' | 'patches'>('entities');
  return {
    entityType,
    setEntityType,
    entityId,
    setEntityId,
    whereJson,
    setWhereJson,
    limitStr,
    setLimitStr,
    offsetStr,
    setOffsetStr,
    mode,
    setMode,
  };
}

function buildQuery(form: QueryFormState): PatchDbQuery {
  const q: PatchDbQuery = { on: form.mode };
  const et = form.entityType.trim();
  if (et) q.entityType = et;
  const eid = form.entityId.trim();
  if (eid) q.entityId = eid;
  const lim = parseInt(form.limitStr, 10);
  if (!Number.isNaN(lim) && lim > 0) q.limit = lim;
  const off = parseInt(form.offsetStr, 10);
  if (!Number.isNaN(off) && off >= 0) q.offset = off;
  const w = form.whereJson.trim();
  if (w) {
    const parsed: unknown = JSON.parse(w);
    q.where = parsed as PatchDbQueryWhereClause;
  }
  return q;
}

function QueryFormCard({
  form,
  running,
  onRun,
}: {
  form: QueryFormState;
  running: boolean;
  onRun: () => void;
}) {
  const { t } = useLingui();
  return (
    <Card elevation={1} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Text variant="bodyBold" label={<Trans>Query</Trans>} />
        <TextInput
          value={form.entityType}
          onChangeText={form.setEntityType}
          placeholder={t`entityType (optional)`}
          autoCapitalize="none"
          sx={INPUT_SX}
        />
        <TextInput
          value={form.entityId}
          onChangeText={form.setEntityId}
          placeholder={t`entityId (optional)`}
          autoCapitalize="none"
          sx={INPUT_SX}
        />
        <TextInput
          value={form.limitStr}
          onChangeText={form.setLimitStr}
          placeholder={t`limit`}
          keyboardType="number-pad"
          sx={INPUT_SX}
        />
        <TextInput
          value={form.offsetStr}
          onChangeText={form.setOffsetStr}
          placeholder={t`offset`}
          keyboardType="number-pad"
          sx={INPUT_SX}
        />
        <Text variant="caption" label={<Trans>where (JSON, optional)</Trans>} />
        <WhereJsonTextInput
          value={form.whereJson}
          onChangeText={form.setWhereJson}
        />
        <Button
          title={running ? t`Running…` : t`Run read([query])`}
          variant="solid"
          onPress={onRun}
        />
      </Stack>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  const theme = useTheme();
  return (
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
        label={message}
      />
    </Card>
  );
}

function ResultCard({ json }: { json: string }) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Card elevation={1} sx={{ p: 3 }}>
      <Text variant="bodyBold" label={t`Result`} />
      <Text
        variant="mono"
        style={{
          fontSize: 11,
          marginTop: 8,
          lineHeight: 16,
          color: theme.colors.text,
        }}
        label={json}
      />
    </Card>
  );
}

export function QueryScreen({ onClose }: QueryScreenProps) {
  const { t } = useLingui();
  const db = usePatchDb();
  const { height: windowHeight } = useWindowDimensions();
  const scrollMaxHeight = Math.min(560, windowHeight * 0.72);
  const form = useQueryFormState();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setResultJson(null);
    try {
      const q = buildQuery(form);
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
          <Button
            title={<Trans>Close</Trans>}
            variant="ghost"
            size="sm"
            onPress={onClose}
          />
        ) : null}

        <SegmentedControl
          segments={[
            { key: 'entities', label: t`entities` },
            { key: 'patches', label: t`patches` },
          ]}
          selected={form.mode}
          onSelect={(k) => form.setMode(k as 'entities' | 'patches')}
        />

        <QueryFormCard form={form} running={running} onRun={() => void run()} />

        {error !== null ? <ErrorCard message={error} /> : null}
        {resultJson !== null ? <ResultCard json={resultJson} /> : null}
      </Stack>
    </ScrollView>
  );
}
