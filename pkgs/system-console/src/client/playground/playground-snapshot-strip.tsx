import { Box, Button, Pressable, ScrollView, Text } from '@pkgs/ui';
import { useEffect, useState } from 'react';

import type {
  PlaygroundSession,
  PlaygroundSnapshotInfo,
} from '../../shared/ports';

export function PlaygroundSnapshotStrip<R>(props: {
  readonly session: PlaygroundSession<R>;
}) {
  const { session } = props;
  const [snaps, setSnaps] = useState<readonly PlaygroundSnapshotInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await session.listSnapshots();
      setSnaps(list);
      await session.refreshSnapshotPaletteCommands();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    void refresh();
  }, [session]);

  return (
    <Box sx={stripSx}>
      <Text
        variant="caption"
        label="Snapshots"
        sx={{ color: 'textSecondary' }}
      />
      <SnapshotChips snaps={snaps} selected={selected} onSelect={setSelected} />
      <SnapshotActions
        busy={busy}
        canLoad={selected !== null}
        onSave={() => {
          setBusy(true);
          setError(null);
          void session
            .saveSnapshot()
            .then(() => refresh())
            .catch((err) =>
              setError(err instanceof Error ? err.message : String(err))
            )
            .finally(() => setBusy(false));
        }}
        onLoad={() => {
          if (selected === null) return;
          setBusy(true);
          setError(null);
          void session
            .loadSnapshot(selected)
            .then(() => refresh())
            .catch((err) =>
              setError(err instanceof Error ? err.message : String(err))
            )
            .finally(() => setBusy(false));
        }}
      />
      {error !== null ? (
        <Text
          variant="caption"
          label={error}
          sx={{ color: 'danger', maxWidth: 200 }}
        />
      ) : null}
    </Box>
  );
}

function SnapshotChips(props: {
  readonly snaps: readonly PlaygroundSnapshotInfo[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
}) {
  const { snaps, selected, onSelect } = props;
  return (
    <ScrollView
      horizontal
      frameSx={{ flex: 1, minWidth: 0 }}
      sx={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}
    >
      {snaps.length === 0 ? (
        <Text
          variant="caption"
          label="None yet"
          sx={{ color: 'textSecondary' }}
        />
      ) : (
        snaps.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s.id)}
            sx={{
              paddingHorizontal: 2,
              paddingVertical: 1,
              borderRadius: 'sm',
              borderWidth: 1,
              borderColor: selected === s.id ? 'tint' : 'border',
              background: selected === s.id ? 'tintSubtle' : 'background',
            }}
          >
            <Text
              variant="caption"
              label={s.label}
              sx={{ color: selected === s.id ? 'tint' : 'text' }}
            />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

function SnapshotActions(props: {
  readonly busy: boolean;
  readonly canLoad: boolean;
  readonly onSave: () => void;
  readonly onLoad: () => void;
}) {
  return (
    <>
      <Button
        title="Save"
        size="sm"
        variant="outline"
        disabled={props.busy}
        onPress={props.onSave}
      />
      <Button
        title="Load"
        size="sm"
        variant="outline"
        disabled={props.busy || !props.canLoad}
        onPress={props.onLoad}
      />
    </>
  );
}

const stripSx = {
  flexGrow: 0,
  flexShrink: 0,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 2,
  paddingHorizontal: 2,
  paddingVertical: 1.5,
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surface',
} as const;
