import {
  Box,
  Button,
  Checkbox,
  CONTENT_EDGE_PADDING_STEP,
  IconButton,
  MutationModal,
  Pressable,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  SegmentedControl,
  Select,
  Text,
  Trash2Icon,
  useCommandPalette,
} from '@pkgs/ui';

import type {
  PlaygroundSession,
  PlaygroundSnapshotInfo,
} from '../../shared/ports';
import {
  formatSnapshotAge,
  formatSnapshotBytes,
  formatSnapshotTitle,
} from './playground-snapshot-format';
import { usePlaygroundSnapshots } from './use-playground-snapshots';
import {
  type SortKey,
  useSnapshotChromeState,
} from './use-snapshot-chrome-state';

const ICON_SIZE = 32;
const GLYPH_SIZE = 16;
const SELECT_WIDTH = 150;

type SnapshotListApi = ReturnType<typeof usePlaygroundSnapshots>;

function SnapshotRowMeta(props: {
  readonly snap: PlaygroundSnapshotInfo;
  readonly nowMs: number;
}) {
  const { snap, nowMs } = props;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      <Text
        variant="caption"
        label={formatSnapshotAge(snap.createdAtMs, nowMs)}
      />
      {snap.totalBytes !== undefined ? (
        <Text
          variant="caption"
          label={`· ${formatSnapshotBytes(snap.totalBytes)}`}
        />
      ) : null}
      {snap.compatible ? null : (
        <Text variant="caption" sx={{ color: 'warning' }} label="· outdated" />
      )}
    </Box>
  );
}

function SnapshotOptionRow(props: {
  readonly snap: PlaygroundSnapshotInfo;
  readonly nowMs: number;
  readonly selected: boolean;
  readonly outdated: boolean;
  readonly busy: boolean;
  readonly checked: boolean;
  readonly onToggleChecked: (next: boolean) => void;
  readonly onPick: () => void;
}) {
  const {
    snap,
    nowMs,
    selected,
    outdated,
    busy,
    checked,
    onToggleChecked,
    onPick,
  } = props;
  const body = (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        paddingVertical: 12,
        gap: 0.5,
      }}
    >
      <Text variant="body" label={formatSnapshotTitle(snap.createdAtMs)} />
      <SnapshotRowMeta snap={snap} nowMs={nowMs} />
    </Box>
  );
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        opacity: outdated ? 0.55 : 1,
      }}
    >
      <Box sx={{ pl: CONTENT_EDGE_PADDING_STEP }}>
        <Checkbox checked={checked} onToggle={onToggleChecked} disabled={busy} />
      </Box>
      {outdated ? (
        body
      ) : (
        <Pressable sx={{ flex: 1, minWidth: 0 }} onPress={onPick}>
          {body}
        </Pressable>
      )}
      {selected && !outdated ? (
        <Box sx={{ pr: CONTENT_EDGE_PADDING_STEP }}>
          <Text variant="label" sx={{ color: 'tint' }} label="✓" />
        </Box>
      ) : null}
    </Box>
  );
}

function SnapshotSurfaceExtra(props: {
  readonly sort: SortKey;
  readonly onSort: (sort: SortKey) => void;
  readonly allChecked: boolean;
  readonly someChecked: boolean;
  readonly checkedCount: number;
  readonly busy: boolean;
  readonly onToggleAll: (next: boolean) => void;
  readonly onDeleteChecked: () => void;
}) {
  const {
    sort,
    onSort,
    allChecked,
    someChecked,
    checkedCount,
    busy,
    onToggleAll,
    onDeleteChecked,
  } = props;
  return (
    <Box sx={{ gap: 1.5 }}>
      <SegmentedControl
        segments={[
          { key: 'newest', label: 'Newest' },
          { key: 'oldest', label: 'Oldest' },
        ]}
        selected={sort}
        onSelect={onSort}
      />
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Checkbox
          label={allChecked ? 'Clear' : 'Select all'}
          checked={allChecked || someChecked}
          onToggle={onToggleAll}
          disabled={busy}
        />
        <Button
          size="sm"
          intent="danger"
          title={
            checkedCount === 0 ? 'Delete' : `Delete ${String(checkedCount)}`
          }
          disabled={busy || checkedCount === 0}
          onPress={onDeleteChecked}
        />
      </Box>
    </Box>
  );
}

function SnapshotSelect(props: {
  readonly list: SnapshotListApi;
  readonly sortedSnaps: readonly PlaygroundSnapshotInfo[];
  readonly snapById: ReadonlyMap<string, PlaygroundSnapshotInfo>;
  readonly selectValue: string;
  readonly sort: SortKey;
  readonly nowMs: number;
  readonly checkedIds: ReadonlySet<string>;
  readonly onSelectId: (id: string) => void;
  readonly onSort: (sort: SortKey) => void;
  readonly onToggleChecked: (id: string, next: boolean) => void;
  readonly onToggleAll: (next: boolean) => void;
  readonly onDeleteChecked: () => void;
}) {
  const {
    list,
    sortedSnaps,
    snapById,
    selectValue,
    sort,
    nowMs,
    checkedIds,
    onSelectId,
    onSort,
    onToggleChecked,
    onToggleAll,
    onDeleteChecked,
  } = props;
  const allChecked =
    sortedSnaps.length > 0 && sortedSnaps.every((s) => checkedIds.has(s.id));
  const someChecked = sortedSnaps.some((s) => checkedIds.has(s.id));
  return (
    <Box
      sx={{
        width: SELECT_WIDTH,
        flexShrink: 0,
        minWidth: 0,
        alignSelf: 'center',
      }}
    >
      <Select
        size="sm"
        options={sortedSnaps.map((s) => ({
          value: s.id,
          label: formatSnapshotAge(s.createdAtMs, nowMs),
          disabled: !s.compatible,
        }))}
        value={selectValue}
        onValueChange={(id) => {
          const snap = snapById.get(id);
          if (snap === undefined || !snap.compatible) return;
          onSelectId(id);
          void list.onLoad(id).catch(() => undefined);
        }}
        surfaceTitle="Snapshots"
        surfaceExtra={
          <SnapshotSurfaceExtra
            sort={sort}
            onSort={onSort}
            allChecked={allChecked}
            someChecked={someChecked}
            checkedCount={checkedIds.size}
            busy={list.busy}
            onToggleAll={onToggleAll}
            onDeleteChecked={onDeleteChecked}
          />
        }
        loading={list.busy}
        error={list.error}
        renderOption={(option, selected, onPick) => {
          const snap = snapById.get(option.value);
          if (snap === undefined) return null;
          const outdated = !snap.compatible;
          return (
            <SnapshotOptionRow
              snap={snap}
              nowMs={nowMs}
              selected={selected}
              outdated={outdated}
              busy={list.busy}
              checked={checkedIds.has(snap.id)}
              onToggleChecked={(next) => onToggleChecked(snap.id, next)}
              onPick={onPick}
            />
          );
        }}
      />
    </Box>
  );
}

function SnapshotChromeActions(props: {
  readonly list: SnapshotListApi;
  readonly hasCompatibleSelection: boolean;
  readonly selectedId: string | null;
  readonly hasIncompatible: boolean;
  readonly onSaved: (id: string) => void;
  readonly onPurge: () => void;
  readonly openPalette: () => void;
}) {
  const {
    list,
    hasCompatibleSelection,
    selectedId,
    hasIncompatible,
    onSaved,
    onPurge,
    openPalette,
  } = props;
  return (
    <>
      <IconButton
        label="Save snapshot"
        size={ICON_SIZE}
        disabled={list.busy}
        onPress={() => {
          void list
            .onSave()
            .then((info) => {
              onSaved(info.id);
            })
            .catch(() => undefined);
        }}
      >
        <SaveIcon size={GLYPH_SIZE} />
      </IconButton>
      <IconButton
        label="Reload current snapshot"
        size={ICON_SIZE}
        disabled={list.busy || !hasCompatibleSelection}
        onPress={() => {
          if (selectedId === null) return;
          void list.onLoad(selectedId);
        }}
      >
        <RotateCcwIcon size={GLYPH_SIZE} />
      </IconButton>
      {hasIncompatible ? (
        <IconButton
          label="Purge incompatible snapshots"
          size={ICON_SIZE}
          disabled={list.busy}
          onPress={onPurge}
        >
          <Trash2Icon size={GLYPH_SIZE} />
        </IconButton>
      ) : null}
      <IconButton
        label="Open command palette"
        size={ICON_SIZE}
        onPress={openPalette}
      >
        <SearchIcon size={GLYPH_SIZE} />
      </IconButton>
    </>
  );
}

/** TabStrip trailing: snapshot Select + save / reload / palette icon buttons. */
export function PlaygroundSnapshotChrome(props: {
  readonly session: PlaygroundSession;
}) {
  const { session } = props;
  const list = usePlaygroundSnapshots(session);
  const state = useSnapshotChromeState(list);
  const { open: openPalette } = useCommandPalette();
  const nowMs = session.clock.now();
  const deleteCount = state.pendingDeleteIds?.length ?? 0;

  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 0.5,
        flexShrink: 0,
        alignSelf: 'stretch',
      }}
    >
      <SnapshotSelect
        list={list}
        sortedSnaps={state.sortedSnaps}
        snapById={state.snapById}
        selectValue={state.selectedId ?? ''}
        sort={state.sort}
        nowMs={nowMs}
        checkedIds={state.checkedIds}
        onSelectId={state.setSelectedId}
        onSort={state.setSort}
        onToggleChecked={state.onToggleChecked}
        onToggleAll={state.onToggleAll}
        onDeleteChecked={() => state.setPendingDeleteIds([...state.checkedIds])}
      />
      <SnapshotChromeActions
        list={list}
        hasCompatibleSelection={state.hasCompatibleSelection}
        selectedId={state.selectedId}
        hasIncompatible={state.hasIncompatible}
        onSaved={state.setSelectedId}
        onPurge={() => state.setPurgeOpen(true)}
        openPalette={openPalette}
      />
      <MutationModal
        visible={state.pendingDeleteIds !== null}
        onClose={state.closeDelete}
        title={
          deleteCount === 1
            ? 'Delete snapshot?'
            : `Delete ${String(deleteCount)} snapshots?`
        }
        message="Permanently remove the selected snapshots from ObjectStore. This cannot be undone."
        submitLabel="Delete"
        variant="destructive"
        operation={state.runDelete}
        successTitle="Deleted"
        successBody="Selected snapshots were removed."
        onSuccess={state.closeDelete}
        stackId="playground-snapshot-chrome-delete"
      />
      <MutationModal
        visible={state.purgeOpen}
        onClose={state.closePurge}
        title="Purge incompatible?"
        message="Delete every snapshot whose schema no longer matches this app. Compatible snapshots are kept."
        submitLabel="Purge incompatible"
        variant="destructive"
        operation={state.runPurge}
        successTitle="Purged"
        successBody="Outdated snapshots were removed."
        onSuccess={state.closePurge}
        stackId="playground-snapshot-chrome-purge"
      />
    </Box>
  );
}
