import { clearLocalDatabaseAndReload } from '@gamezilla/client/ui/patch-bootstrap';
import { ConfirmationModal, RegisterCommand } from '@gamezilla/lib/ui';
import { useState } from 'react';

export function WipeLocalDatabaseCommand() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <RegisterCommand
        id="data-wipe-local-database"
        title="Wipe local database"
        subtitle="Clear SQLite and reload (same as Clear data in Todos)"
        category="Data"
        icon="database.fill"
        keywords={[
          'wipe',
          'clear',
          'reset',
          'sqlite',
          'database',
          'reload',
          'local',
        ]}
        run={async () => {
          setVisible(true);
        }}
      />
      <ConfirmationModal
        visible={visible}
        title="Wipe local database?"
        message="This deletes all local SQLite data and reloads the app. You cannot undo this."
        variant="destructive"
        confirmLabel="Wipe and reload"
        onConfirm={async () => {
          setVisible(false);
          await clearLocalDatabaseAndReload('main');
        }}
        onCancel={() => setVisible(false)}
      />
    </>
  );
}
