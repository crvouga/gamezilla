import { Button, ScrollView, Stack, Text, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

import {
  Decrement,
  Increment,
  readPlaygroundCount,
  usePlaygroundDualLoopback,
} from './use-playground-dual-loopback';

function CounterColumn(props: {
  title: string;
  count: number;
  onInc: () => void;
  onDec: () => void;
  disabled: boolean;
}) {
  return (
    <Stack spacing={2} sx={{ minWidth: 200 }}>
      <Text variant="subtitle" label={props.title} />
      <Text variant="heading" label={String(props.count)} />
      <Stack direction="horizontal" spacing={2}>
        <Button title="+1" onPress={props.onInc} disabled={props.disabled} />
        <Button title="-1" onPress={props.onDec} disabled={props.disabled} />
      </Stack>
    </Stack>
  );
}

export function PlaygroundPage() {
  const { t } = useLingui();
  const { colors } = useTheme();
  const { roomA, roomB, error } = usePlaygroundDualLoopback();

  return (
    <ScrollView sx={{ flex: 1, px: 4, py: 3 }}>
      <Stack spacing={3} sx={{ pb: 8 }}>
        <Text variant="title" label={t`Room v2 (loopback)`} />
        {error !== null ? (
          <Text variant="body" sx={{ color: colors.destructive }} label={error} />
        ) : (
          <Text
            variant="body"
            sx={{ color: colors.textSecondary }}
            label={t`Two clients share one in-memory RoomServer; increments converge on both.`}
          />
        )}
        <Stack direction="horizontal" spacing={4} wrap sx={{ rowGap: 16 }}>
          <CounterColumn
            title={t`Client A (alice)`}
            count={readPlaygroundCount(roomA)}
            onInc={() => roomA?.dispatch(Increment({}))}
            onDec={() => roomA?.dispatch(Decrement({}))}
            disabled={roomA === null}
          />
          <CounterColumn
            title={t`Client B (bob)`}
            count={readPlaygroundCount(roomB)}
            onInc={() => roomB?.dispatch(Increment({}))}
            onDec={() => roomB?.dispatch(Decrement({}))}
            disabled={roomB === null}
          />
        </Stack>
      </Stack>
    </ScrollView>
  );
}
