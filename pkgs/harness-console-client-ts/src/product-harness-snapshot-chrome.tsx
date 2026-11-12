import type { ProductHarnessSession } from '@pkgs/harness-console-shared-ts/ports';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  RotateCcwIcon,
  SaveIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from '@pkgs/ui-root-client-ts/icons';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useTheme } from '@pkgs/ui-root-client-ts/theme-context';
import { useCommandPalette } from '@pkgs/ui-root-client-ts/use-command-palette';
import { createSignal } from 'solid-js';
import { SnapshotChromeModals } from './product-harness-snapshot-modals';
import { SnapshotSelect } from './product-harness-snapshot-select';
import { useProductHarnessSnapshots } from './use-product-harness-snapshots';
import { useSnapshotChromeState } from './use-snapshot-chrome-state';

const ICON_SIZE = 32;
const GLYPH_SIZE = 16;
type SnapshotListApi = ReturnType<typeof useProductHarnessSnapshots>;
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
/** Snapshot Select + save / reload / palette icon buttons. */
export function ProductHarnessSnapshotChrome(props: {
  readonly session: ProductHarnessSession;
}) {
  const theme = useTheme();
  const compact = () => theme.breakpoint() === 'mobile';
  const list = useProductHarnessSnapshots(() => props.session);
  const state = useSnapshotChromeState(list);
  const palette = useCommandPalette();
  const [compactOpen, setCompactOpen] = createSignal(false);
  const nowMs = () => {
    list.snaps;
    list.busy;
    return props.session.clock.now();
  };
  return (
    <StackHorizontal
      grow={compact()}
      align="center"
      justify={compact() ? 'start' : 'end'}
      gap="xs"
    >
      {compact() ? (
        <IconButton
          label="Open harness controls"
          size={ICON_SIZE}
          onClick={() => setCompactOpen(true)}
        >
          <SlidersHorizontalIcon size={GLYPH_SIZE} color="icon" />
        </IconButton>
      ) : (
        <SnapshotSelect
          list={list}
          sortedSnaps={state.sortedSnaps}
          snapById={state.snapById}
          selectValue={state.selectedId ?? ''}
          sort={state.sort}
          nowMs={nowMs()}
          checkedIds={state.checkedIds}
          compact={compact()}
          onSelectId={state.setSelectedId}
          onSort={state.setSort}
          onToggleChecked={state.onToggleChecked}
          onToggleAll={state.onToggleAll}
          onDeleteChecked={() =>
            state.setPendingDeleteIds([...state.checkedIds])
          }
        />
      )}
      {compact() ? (
        <CompactSnapshotSurface
          open={compactOpen}
          setOpen={setCompactOpen}
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
    </StackHorizontal>
  );
}
function CompactSnapshotSurface(props: {
  readonly open: () => boolean;
  readonly setOpen: (value: boolean) => void;
  readonly list: SnapshotListApi;
  readonly state: ReturnType<typeof useSnapshotChromeState>;
  readonly palette: ReturnType<typeof useCommandPalette>;
  readonly nowMs: () => number;
}) {
  return (
    <ResponsiveSurface
      visible={props.open()}
      onClose={() => props.setOpen(false)}
      title="Harness controls"
      label="Harness controls"
      size="small"
      stackId="product-harness-snapshot-controls"
    >
      <StackVertical gap="lg">
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
      </StackVertical>
    </ResponsiveSurface>
  );
}
