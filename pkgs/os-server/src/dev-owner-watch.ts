// @io-wall-ok — independent boot watchdog survives supervisor SIGKILL.
import { gcDevOwner } from './dev-owner-gc';
import {
  type OwnerBoot,
  ownerRecords,
  processSnapshot,
  recordOwned,
  sameProcess,
} from './dev-owner-state';

const root = process.env['DEV_OWNER_ROOT'];
const id = process.env['DEV_OWNER_BOOT'];
if (!root || !id) throw new Error('Watchdog requires an ownership stamp');
const boot = ownerRecords<OwnerBoot>(root, 'boot-').find(
  (entry) => entry.id === id
);
if (!boot) throw new Error('Watchdog requires a registered boot');
while (true) {
  const rows = processSnapshot();
  recordOwned(root, rows);
  if (!rows.some((row) => sameProcess(row, boot.supervisor))) break;
  if (boot.launcher && !rows.some((row) => sameProcess(row, boot.launcher!)))
    break;
  if (
    boot.launchers?.some(
      (parent) => !rows.some((row) => sameProcess(row, parent))
    )
  )
    break;
  await Bun.sleep(2000);
}
await gcDevOwner(root, true, id);
