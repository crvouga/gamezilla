// @io-wall-ok — independent boot watchdog survives supervisor SIGKILL.
import { gcDevOwner } from './dev-owner-gc';
import {
  bootAttended,
  type OwnerBoot,
  ownerLog,
  ownerRecords,
  processSnapshot,
  recordOwned,
} from './dev-owner-state';

const root = process.env['DEV_OWNER_ROOT'];
const id = process.env['DEV_OWNER_BOOT'];
if (!root || !id) throw new Error('Watchdog requires an ownership stamp');
const boot = ownerRecords<OwnerBoot>(root, 'boot-').find(
  (entry) => entry.id === id
);
if (!boot) throw new Error('Watchdog requires a registered boot');
const report = ownerLog(root);
while (true) {
  const rows = processSnapshot();
  recordOwned(root, rows);
  if (!bootAttended(boot, rows)) break;
  await Bun.sleep(2000);
}
report(`[watch] boot=${id} lost its supervisor or launcher; collecting it\n`);
await gcDevOwner(root, true, id, report);
