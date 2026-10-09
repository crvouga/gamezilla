// @io-wall-ok — process ownership at a composition root.
export function processLifecycle() {
  return {
    env: process.env as Readonly<Record<string, string | undefined>>,
    onTermination(listener: () => void): () => void {
      process.on('SIGTERM', listener);
      process.on('SIGINT', listener);
      return () => {
        process.off('SIGTERM', listener);
        process.off('SIGINT', listener);
      };
    },
    resources() {
      const cpu = process.cpuUsage();
      return {
        memoryBytes: process.memoryUsage().rss,
        cpuMilliseconds: Math.floor((cpu.user + cpu.system) / 1000),
      };
    },
    exit: (code: number): never => process.exit(code),
  };
}
