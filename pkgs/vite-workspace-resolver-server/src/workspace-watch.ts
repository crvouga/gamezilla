import type { WatchOptions } from 'vite';

/** Keep runtime output and linked copies of the workspace off the HMR graph. */
export function workspaceWatchOptions(): WatchOptions {
  return {
    // FSEvents fans every event out to every linked path's listener. In a
    // workspace that can starve HTTP entirely; fs.watch stays directory scoped.
    useFsEvents: false,
    usePolling: false,
    followSymlinks: false,
    ignored: ['**/.cache/**', '**/.turbo/**', '**/.feedback/**', '**/dist/**'],
  };
}
