import {
  Button,
  Checkbox,
  CONTENT_EDGE_PADDING_STEP,
  Columns2Icon,
  IconButton,
  ResponsiveSurface,
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  SegmentedControl,
  Select,
  SlidersHorizontalIcon,
  SquareStackIcon,
  Trash2Icon,
  useCommandPalette,
} from '@pkgs/ui';
import { createSignal, Show } from 'solid-js';
import type {
  ProductSimulatorSession,
  ProductSimulatorSnapshotInfo,
} from '../../shared/ports';
import type { ClientLayoutMode } from '../debugger/sim-console-layout';
import {
  useClientLayoutPreference,
  useSimConsoleLayout,
} from '../debugger/use-sim-console-layout';
import {
  formatSnapshotAge,
  formatSnapshotBytes,
  formatSnapshotTitle,
} from './product-simulator-snapshot-format';
import { SnapshotChromeModals } from './product-simulator-snapshot-modals';
import { useProductSimulatorSnapshots } from './use-product-simulator-snapshots';
import {
  type SortKey,
  useSnapshotChromeState,
} from './use-snapshot-chrome-state';

const ICON_SIZE = 32;
const GLYPH_SIZE = 16;
const SELECT_WIDTH = 150;
type SnapshotListApi = ReturnType<typeof useProductSimulatorSnapshots>;
function SnapshotRowMeta(props: {
  readonly snap: ProductSimulatorSnapshotInfo;
  readonly nowMs: number;
}) {
  return (
    <div class="box flex-row items-center gap-1 flex-wrap">
      <p class="text textCaption">
        {formatSnapshotAge(props.snap.createdAtMs, props.nowMs)}
      </p>
      {props.snap.totalBytes !== undefined ? (
        <p class="text textCaption">{`· ${formatSnapshotBytes(props.snap.totalBytes)}`}</p>
      ) : null}
      {props.snap.compatible ? null : (
        <p class="text textCaption text-warning">{'· outdated'}</p>
      )}
    </div>
  );
}
function SnapshotOptionRow(props: {
  readonly snap: ProductSimulatorSnapshotInfo;
  readonly nowMs: number;
  readonly selected: boolean;
  readonly outdated: boolean;
  readonly busy: boolean;
  readonly checked: boolean;
  readonly onToggleChecked: (next: boolean) => void;
  readonly onPick: () => void;
}) {
  const body = (
    <div class="box flex-1 min-w-[0] [padding-top:12px;padding-bottom:12px] gap-0.5">
      <p class="text text-text">{formatSnapshotTitle(props.snap.createdAtMs)}</p>
      <SnapshotRowMeta snap={props.snap} nowMs={props.nowMs} />
    </div>
  );
  return (
    <div
      class="box flex-row items-center gap-3 min-w-[0]"
      style={{
        ...(props.selected && !props.outdated
          ? {}
          : { 'padding-right': `${CONTENT_EDGE_PADDING_STEP * 4}px` }),
        opacity: props.outdated ? 0.55 : 1,
      }}
    >
      <div
        class="box"
        style={{ 'padding-left': `${CONTENT_EDGE_PADDING_STEP * 4}px` }}
      >
        <Checkbox
          checked={props.checked}
          onToggle={props.onToggleChecked}
          disabled={props.busy}
        />
      </div>
      {props.outdated ? (
        body
      ) : (
        <button
          class="clickable clickableTint flex-1 min-w-[0]"
          type="button"
          onClick={props.onPick}
        >
          {body}
        </button>
      )}
      {props.selected && !props.outdated ? (
        <div
          class="box"
          style={{ 'padding-right': `${CONTENT_EDGE_PADDING_STEP * 4}px` }}
        >
          <label class="text textLabel text-tint">{'✓'}</label>
        </div>
      ) : null}
    </div>
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
  return (
    <div class="box gap-1.5">
      <SegmentedControl
        segments={[
          { key: 'newest', label: 'Newest' },
          { key: 'oldest', label: 'Oldest' },
        ]}
        selected={props.sort}
        onSelect={props.onSort}
      />
      <div class="box flex-row items-center justify-between gap-1">
        <Checkbox
          label={props.allChecked ? 'Clear' : 'Select all'}
          checked={props.allChecked || props.someChecked}
          onToggle={props.onToggleAll}
          disabled={props.busy}
        />
        <Button
          size="sm"
          intent="danger"
          title={
            props.checkedCount === 0
              ? 'Delete'
              : `Delete ${String(props.checkedCount)}`
          }
          disabled={props.busy || props.checkedCount === 0}
          onClick={props.onDeleteChecked}
        />
      </div>
    </div>
  );
}
function SnapshotSelect(props: {
  readonly list: SnapshotListApi;
  readonly sortedSnaps: readonly ProductSimulatorSnapshotInfo[];
  readonly snapById: ReadonlyMap<string, ProductSimulatorSnapshotInfo>;
  readonly selectValue: string;
  readonly sort: SortKey;
  readonly nowMs: number;
  readonly checkedIds: ReadonlySet<string>;
  readonly compact: boolean;
  readonly onSelectId: (id: string) => void;
  readonly onSort: (sort: SortKey) => void;
  readonly onToggleChecked: (id: string, next: boolean) => void;
  readonly onToggleAll: (next: boolean) => void;
  readonly onDeleteChecked: () => void;
}) {
  const allChecked = () =>
    props.sortedSnaps.length > 0 &&
    props.sortedSnaps.every((s) => props.checkedIds.has(s.id));
  const someChecked = () =>
    props.sortedSnaps.some((s) => props.checkedIds.has(s.id));
  return (
    <div class="box" style={props.compact ? selectCompactSx : selectDesktopSx}>
      <Select
        size="sm"
        options={props.sortedSnaps.map((s) => ({
          value: s.id,
          label: formatSnapshotAge(s.createdAtMs, props.nowMs),
          disabled: !s.compatible,
        }))}
        value={props.selectValue}
        onValueChange={(id) => {
          const snap = props.snapById.get(id);
          if (snap === undefined || !snap.compatible) return;
          props.onSelectId(id);
          void props.list.onLoad(id).catch(() => undefined);
        }}
        surfaceTitle="Snapshots"
        surfaceExtra={
          <SnapshotSurfaceExtra
            sort={props.sort}
            onSort={props.onSort}
            allChecked={allChecked()}
            someChecked={someChecked()}
            checkedCount={props.checkedIds.size}
            busy={props.list.busy}
            onToggleAll={props.onToggleAll}
            onDeleteChecked={props.onDeleteChecked}
          />
        }
        loading={props.list.busy}
        error={props.list.error}
        renderOption={(option, selected, onPick) => (
          <SnapshotSelectOption
            snap={props.snapById.get(option.value)}
            nowMs={props.nowMs}
            selected={selected}
            busy={props.list.busy}
            checked={
              props.snapById.get(option.value) !== undefined &&
              props.checkedIds.has(option.value)
            }
            onToggleChecked={(next) =>
              props.onToggleChecked(option.value, next)
            }
            onPick={onPick}
          />
        )}
      />
    </div>
  );
}
function SnapshotSelectOption(props: {
  readonly snap: ProductSimulatorSnapshotInfo | undefined;
  readonly nowMs: number;
  readonly selected: boolean;
  readonly busy: boolean;
  readonly checked: boolean;
  readonly onToggleChecked: (next: boolean) => void;
  readonly onPick: () => void;
}) {
  return (
    <Show when={props.snap}>
      {(snap) => (
        <SnapshotOptionRow
          snap={snap()}
          nowMs={props.nowMs}
          selected={props.selected}
          outdated={!snap().compatible}
          busy={props.busy}
          checked={props.checked}
          onToggleChecked={props.onToggleChecked}
          onPick={props.onPick}
        />
      )}
    </Show>
  );
}
const selectCompactSx = {
  flex: 1,
  'min-width': 0,
  'align-self': 'center',
} as const;
const selectDesktopSx = {
  width: `${SELECT_WIDTH}px`,
  'flex-shrink': 0,
  'min-width': 0,
  'align-self': 'center',
} as const;
const chromeRowCompactSx = {
  'flex-direction': 'row',
  'align-items': 'center',
  'justify-content': 'flex-start',
  gap: '2px',
  'flex-shrink': 1,
  flex: 1,
  'min-width': 0,
  'align-self': 'stretch',
} as const;
const chromeRowDesktopSx = {
  'flex-direction': 'row',
  'align-items': 'center',
  'justify-content': 'flex-end',
  gap: '2px',
  'flex-shrink': 0,
  'min-width': 0,
  'align-self': 'stretch',
} as const;
function SnapshotChromeActions(props: {
  readonly list: SnapshotListApi;
  readonly hasCompatibleSelection: boolean;
  readonly selectedId: string | null;
  readonly hasIncompatible: boolean;
  readonly onSaved: (id: string) => void;
  readonly onPurge: () => void;
  readonly openPalette: () => void;
}) {
  return (
    <>
      <IconButton
        label="Save snapshot"
        size={ICON_SIZE}
        disabled={props.list.busy}
        onClick={() => {
          void props.list
            .onSave()
            .then((info) => {
              props.onSaved(info.id);
            })
            .catch(() => undefined);
        }}
      >
        <SaveIcon size={GLYPH_SIZE} color="icon" />
      </IconButton>
      <IconButton
        label="Reload current snapshot"
        size={ICON_SIZE}
        disabled={props.list.busy || !props.hasCompatibleSelection}
        onClick={() => {
          if (props.selectedId === null) return;
          void props.list.onLoad(props.selectedId);
        }}
      >
        <RotateCcwIcon size={GLYPH_SIZE} color="icon" />
      </IconButton>
      {props.hasIncompatible ? (
        <IconButton
          label="Purge incompatible snapshots"
          size={ICON_SIZE}
          disabled={props.list.busy}
          onClick={props.onPurge}
        >
          <Trash2Icon size={GLYPH_SIZE} color="icon" />
        </IconButton>
      ) : null}
      <IconButton
        label="Open command palette"
        size={ICON_SIZE}
        onClick={props.openPalette}
      >
        <SearchIcon size={GLYPH_SIZE} color="icon" />
      </IconButton>
    </>
  );
}
function ClientLayoutToggle(props: {
  readonly preference: ClientLayoutMode;
  readonly onSelect: (mode: ClientLayoutMode) => void;
}) {
  return (
    <div class="box flex-row items-center gap-px shrink-0">
      <IconButton
        label="Tab clients"
        size={ICON_SIZE}
        {...(props.preference === 'tabs'
          ? { background: 'tintSubtle' }
          : {})}
        onClick={() => {
          props.onSelect('tabs');
        }}
      >
        <SquareStackIcon size={GLYPH_SIZE} color="icon" />
      </IconButton>
      <IconButton
        label="Column clients"
        size={ICON_SIZE}
        {...(props.preference === 'columns'
          ? { background: 'tintSubtle' }
          : {})}
        onClick={() => {
          props.onSelect('columns');
        }}
      >
        <Columns2Icon size={GLYPH_SIZE} color="icon" />
      </IconButton>
    </div>
  );
}
/** Snapshot Select + save / reload / palette icon buttons. */
export function ProductSimulatorSnapshotChrome(props: {
  readonly session: ProductSimulatorSession;
}) {
  const layout = useSimConsoleLayout();
  const preference = useClientLayoutPreference();
  const list = useProductSimulatorSnapshots(() => props.session);
  const state = useSnapshotChromeState(list);
  const palette = useCommandPalette();
  const [compactOpen, setCompactOpen] = createSignal(false);
  const nowMs = () => {
    list.snaps;
    list.busy;
    return props.session.clock.now();
  };
  return (
    <div
      class="box"
      style={layout.compactChrome ? chromeRowCompactSx : chromeRowDesktopSx}
    >
      {layout.compactChrome ? (
        <IconButton
          label="Open simulator controls"
          size={ICON_SIZE}
          onClick={() => setCompactOpen(true)}
        >
          <SlidersHorizontalIcon size={GLYPH_SIZE} color="icon" />
        </IconButton>
      ) : (
        <ClientLayoutToggle
          preference={preference.preference}
          onSelect={preference.setPreference}
        />
      )}
      {layout.compactChrome ? null : (
        <SnapshotSelect
          list={list}
          sortedSnaps={state.sortedSnaps}
          snapById={state.snapById}
          selectValue={state.selectedId ?? ''}
          sort={state.sort}
          nowMs={nowMs()}
          checkedIds={state.checkedIds}
          compact={layout.compactChrome}
          onSelectId={state.setSelectedId}
          onSort={state.setSort}
          onToggleChecked={state.onToggleChecked}
          onToggleAll={state.onToggleAll}
          onDeleteChecked={() =>
            state.setPendingDeleteIds([...state.checkedIds])
          }
        />
      )}
      {layout.compactChrome ? (
        <CompactSnapshotSurface
          open={compactOpen}
          setOpen={setCompactOpen}
          preference={preference}
          list={list}
          state={state}
          palette={palette}
          nowMs={nowMs}
        />
      ) : (
        <SnapshotChromeActions
          list={list}
          hasCompatibleSelection={state.hasCompatibleSelection}
          selectedId={state.selectedId}
          hasIncompatible={state.hasIncompatible}
          onSaved={state.setSelectedId}
          onPurge={() => state.setPurgeOpen(true)}
          openPalette={palette.open}
        />
      )}
      <SnapshotChromeModals state={state} />
    </div>
  );
}
function CompactSnapshotSurface(props: {
  readonly open: () => boolean;
  readonly setOpen: (value: boolean) => void;
  readonly preference: ReturnType<typeof useClientLayoutPreference>;
  readonly list: SnapshotListApi;
  readonly state: ReturnType<typeof useSnapshotChromeState>;
  readonly palette: ReturnType<typeof useCommandPalette>;
  readonly nowMs: () => number;
}) {
  return (
    <ResponsiveSurface
      visible={props.open()}
      onClose={() => props.setOpen(false)}
      title="Simulator controls"
      label="Simulator controls"
      size="small"
      stackId="product-simulator-snapshot-controls"
    >
      <div class="box gap-3">
        <ClientLayoutToggle
          preference={props.preference.preference}
          onSelect={props.preference.setPreference}
        />
        <SnapshotSelect
          list={props.list}
          sortedSnaps={props.state.sortedSnaps}
          snapById={props.state.snapById}
          selectValue={props.state.selectedId ?? ''}
          sort={props.state.sort}
          nowMs={props.nowMs()}
          checkedIds={props.state.checkedIds}
          compact
          onSelectId={props.state.setSelectedId}
          onSort={props.state.setSort}
          onToggleChecked={props.state.onToggleChecked}
          onToggleAll={props.state.onToggleAll}
          onDeleteChecked={() =>
            props.state.setPendingDeleteIds([...props.state.checkedIds])
          }
        />
        <SnapshotChromeActions
          list={props.list}
          hasCompatibleSelection={props.state.hasCompatibleSelection}
          selectedId={props.state.selectedId}
          hasIncompatible={props.state.hasIncompatible}
          onSaved={props.state.setSelectedId}
          onPurge={() => props.state.setPurgeOpen(true)}
          openPalette={props.palette.open}
        />
      </div>
    </ResponsiveSurface>
  );
}
