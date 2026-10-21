import type { ProductHarnessSnapshotInfo } from '@pkgs/harness-console-shared/ports';
import { Button } from '@pkgs/ui-root-client/button';
import { Checkbox } from '@pkgs/ui-root-client/checkbox';
import { CheckIcon } from '@pkgs/ui-root-client/icons';
import { Pressable } from '@pkgs/ui-root-client/pressable';
import { SegmentedControl } from '@pkgs/ui-root-client/segmented-control';
import { Select } from '@pkgs/ui-root-client/select';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import { type JSX, Show } from 'solid-js';
import {
  formatSnapshotAge,
  formatSnapshotBytes,
  formatSnapshotTitle,
} from './product-harness-snapshot-format';
import type { useProductHarnessSnapshots } from './use-product-harness-snapshots';
import type { SortKey } from './use-snapshot-chrome-state';

type SnapshotListApi = ReturnType<typeof useProductHarnessSnapshots>;

function SnapshotRowMeta(props: {
  readonly snap: ProductHarnessSnapshotInfo;
  readonly nowMs: number;
}) {
  return (
    <StackHorizontal align="center" gap="xs" wrap>
      <P variant="caption">
        {formatSnapshotAge(props.snap.createdAtMs, props.nowMs)}
      </P>
      {props.snap.totalBytes !== undefined ? (
        <P variant="caption" numeral>
          {`· ${formatSnapshotBytes(props.snap.totalBytes)}`}
        </P>
      ) : null}
      {props.snap.compatible ? null : (
        <P variant="caption" tone="warning">
          {'· outdated'}
        </P>
      )}
    </StackHorizontal>
  );
}

function SnapshotOptionBody(props: {
  readonly snap: ProductHarnessSnapshotInfo;
  readonly nowMs: number;
  readonly outdated: boolean;
}) {
  return (
    <StackVertical grow paddingY="md" gap="xs">
      <P tone={props.outdated ? 'secondary' : 'default'} lines={1}>
        {formatSnapshotTitle(props.snap.createdAtMs)}
      </P>
      <SnapshotRowMeta snap={props.snap} nowMs={props.nowMs} />
    </StackVertical>
  );
}

function SnapshotOptionRow(props: {
  readonly snap: ProductHarnessSnapshotInfo;
  readonly nowMs: number;
  readonly selected: boolean;
  readonly outdated: boolean;
  readonly busy: boolean;
  readonly checked: boolean;
  readonly onToggleChecked: (next: boolean) => void;
  readonly onPick: () => void;
}) {
  const body = (): JSX.Element => (
    <SnapshotOptionBody
      snap={props.snap}
      nowMs={props.nowMs}
      outdated={props.outdated}
    />
  );
  return (
    <StackHorizontal align="center" gap="md" paddingX="lg">
      <Checkbox
        checked={props.checked}
        onToggle={props.onToggleChecked}
        disabled={props.busy}
      />
      <Show
        when={!props.outdated}
        fallback={<StackHorizontal grow>{body()}</StackHorizontal>}
      >
        <Pressable grow onPress={props.onPick} selected={props.selected}>
          {body()}
        </Pressable>
      </Show>
      <Show when={props.selected && !props.outdated}>
        <CheckIcon size={16} color="tint" />
      </Show>
    </StackHorizontal>
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
    <StackVertical gap="sm">
      <SegmentedControl
        segments={[
          { key: 'newest', label: 'Newest' },
          { key: 'oldest', label: 'Oldest' },
        ]}
        selected={props.sort}
        onSelect={props.onSort}
      />
      <StackHorizontal align="center" justify="between" gap="xs">
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
      </StackHorizontal>
    </StackVertical>
  );
}

/** Snapshot picker: age per option, sort, bulk select and delete. */
export function SnapshotSelect(props: {
  readonly list: SnapshotListApi;
  readonly sortedSnaps: readonly ProductHarnessSnapshotInfo[];
  readonly snapById: ReadonlyMap<string, ProductHarnessSnapshotInfo>;
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
    <StackHorizontal grow={props.compact} align="center">
      <Select
        size="sm"
        aria-label="Snapshot"
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
          <Show when={props.snapById.get(option.value)}>
            {(snap) => (
              <SnapshotOptionRow
                snap={snap()}
                nowMs={props.nowMs}
                selected={selected}
                outdated={!snap().compatible}
                busy={props.list.busy}
                checked={props.checkedIds.has(option.value)}
                onToggleChecked={(next) =>
                  props.onToggleChecked(option.value, next)
                }
                onPick={onPick}
              />
            )}
          </Show>
        )}
      />
    </StackHorizontal>
  );
}
