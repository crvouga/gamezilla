import { wallIo } from '@pkgs/io';

const io = wallIo();

/** Simple delay for pacing UI transitions. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    io.timers.setTimeout(resolve, ms);
  });
}
