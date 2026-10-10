// @io-wall-ok — container readiness probe process entry.
import { processLifecycle } from '@pkgs/os-server/process-lifecycle';
import { workerWallPorts } from '../src/wall-io';

const os = processLifecycle();
const { http } = workerWallPorts();
const port = Number(os.env['PORT'] ?? '8080');
try {
  const result = await http(`http://127.0.0.1:${port}/ready`);
  os.exit(result.ok ? 0 : 1);
} catch {
  os.exit(1);
}
