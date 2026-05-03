import { clearLocalDatabaseAndReload } from '@gamezilla/client/ui/patch-db-bootstrap';
import { ConfirmationModal, RegisterCommand } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

export function WipeLocalDatabaseCommand() {
  const { t } = useLingui();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <RegisterCommand
        id="data-wipe-local-database"
        title={t`Wipe local database`}
        subtitle={t`Clear SQLite and reload (same as Clear data in Todos)`}
        category={t`Data`}
        icon="database.fill"
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
      <ConfirmationModal
        visible={visible}
        title={<Trans>Wipe local database?</Trans>}
        message={
          <Trans>
            This deletes all local SQLite data and reloads the app. You cannot
            undo this.
          </Trans>
        }
        variant="destructive"
        confirmLabel={<Trans>Wipe and reload</Trans>}
        onConfirm={() => {
          setVisible(false);
          void clearLocalDatabaseAndReload();
        }}
        onCancel={() => setVisible(false)}
      />
    </>
  );
}
