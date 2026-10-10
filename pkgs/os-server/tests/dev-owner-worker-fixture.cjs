// @io-wall-ok — deterministic interleaving of real worker registration writes.
const fs = require('node:fs');
const { Worker, isMainThread, workerData } = require('node:worker_threads');

if (isMainThread) {
  const hook = JSON.parse(
    process.env.NODE_OPTIONS.match(/--require ("[^"]+")/)[1]
  );
  const gate = new SharedArrayBuffer(4);
  const workers = [0, 1].map(
    () =>
      new Worker(__filename, {
        execArgv: [],
        env: { ...process.env, NODE_OPTIONS: '' },
        workerData: { gate, hook },
      })
  );
  Promise.all(
    workers.map(
      (worker) =>
        new Promise((resolve, reject) => {
          worker.once('error', reject);
          worker.once('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`Worker exit ${code}`))
          );
        })
    )
  ).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  const gate = new Int32Array(workerData.gate);
  const rename = fs.renameSync;
  fs.renameSync = (...args) => {
    // Both writes finish before either rename; shared temporary paths must fail.
    Atomics.add(gate, 0, 1);
    Atomics.notify(gate, 0);
    while (Atomics.load(gate, 0) < 2) Atomics.wait(gate, 0, 1);
    return rename(...args);
  };
  require(workerData.hook);
}
