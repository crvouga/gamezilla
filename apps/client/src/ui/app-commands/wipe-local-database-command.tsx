import { useSyncLocalDataActions } from '@libs/auth/root/client/sync-local-data-actions-context';
import { Trans, useLingui } from '@lingui/react/macro';
import { DatabaseIcon, MutationModal, RegisterCommand } from '@pkgs/ui';
import { useCallback, useState } from 'react';

export function WipeLocalDatabaseCommand() {
  const { t } = useLingui();
  const { clearLocalDatabaseAndReload } = useSyncLocalDataActions();
  const [visible, setVisible] = useState(false);
  const operation = useCallback(async () => {
    await clearLocalDatabaseAndReload();
  }, [clearLocalDatabaseAndReload]);
  return (
    <>
      <RegisterCommand
        id="data-wipe-local-database"
        title={t`Wipe local database`}
        subtitle={t`Clear local sync data and reload`}
        category={t`Data`}
        icon={DatabaseIcon}
        keywords={[
          t`wipe`,
          t`clear`,
          t`reset`,
          t`sqlite`,
          t`database`,
          t`reload`,
          t`local`,
        ]}
        run={async () => {
          setVisible(true);
        }}
      />
      <MutationModal
        visible={visible}
        onClose={() => setVisible(false)}
        title={<Trans>Wipe local database?</Trans>}
        message={
          <Trans>
            This deletes all local SQLite data and reloads the app. You cannot
            undo this.
          </Trans>
        }
        submitLabel={<Trans>Wipe and reload</Trans>}
        variant="destructive"
        operation={operation}
        loadingLabel={<Trans>Wiping local database…</Trans>}
        successTitle={<Trans>Local database wiped</Trans>}
        errorTitle={<Trans>Could not wipe database</Trans>}
      />
    </>
  );
}
