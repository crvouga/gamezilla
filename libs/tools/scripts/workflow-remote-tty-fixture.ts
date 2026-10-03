// Spawned with stdin on a pty. The regression writes scroll keys here.
import { holdTTY } from './workflow-remote';

const hold = holdTTY();
console.log('READY');
await new Promise<void>((resolve) => {
  let input = '';
  const receive = (data: Buffer) => {
    input += data.toString();
    if (input.includes('\u001b[B'.repeat(3))) {
      process.stdin.off('data', receive);
      resolve();
    }
  };
  process.stdin.on('data', receive);
});
hold.release();
console.log('DONE');
