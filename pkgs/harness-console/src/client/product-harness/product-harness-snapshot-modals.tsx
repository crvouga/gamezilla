import { MutationModal } from '@pkgs/ui';

import type { useSnapshotChromeState } from './use-snapshot-chrome-state';

export function SnapshotChromeModals(props: {
  readonly state: ReturnType<typeof useSnapshotChromeState>;
}) {
  return (
    <>
      <MutationModal
        visible={props.state.pendingDeleteIds !== null}
        onClose={props.state.closeDelete}
        title={
          props.state.pendingDeleteIds?.length === 1
            ? 'Delete snapshot?'
            : `Delete ${String(props.state.pendingDeleteIds?.length ?? 0)} snapshots?`
        }
        message="Permanently remove the selected snapshots from ObjectStore. This cannot be undone."
        submitLabel="Delete"
        variant="destructive"
        operation={props.state.runDelete}
        successTitle="Deleted"
        successBody="Selected snapshots were removed."
        onSuccess={props.state.closeDelete}
        stackId="product-harness-snapshot-chrome-delete"
      />
      <MutationModal
        visible={props.state.purgeOpen}
        onClose={props.state.closePurge}
        title="Purge incompatible?"
        message="Delete every snapshot whose schema no longer matches this app. Compatible snapshots are kept."
        submitLabel="Purge incompatible"
        variant="destructive"
        operation={props.state.runPurge}
        successTitle="Purged"
        successBody="Outdated snapshots were removed."
        onSuccess={props.state.closePurge}
        stackId="product-harness-snapshot-chrome-purge"
      />
    </>
  );
}
