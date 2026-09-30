// Spawned with stdin on a pty. The regression writes scroll keys here.
import { holdTTY } from './workflow-remote';

const hold = holdTTY();
console.log('READY');
await Bun.sleep(800);
hold.release();
console.log('DONE');
