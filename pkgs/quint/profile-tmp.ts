// Throwaway profiler: per-case and per-conjunct Apalache timings for split induction.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { APALACHE_VERSION, freePort, linkQuintHome, resolveApalache, verifyEnv } from './src/apalache';
import { runQuint } from './src/run-quint';
import { QUINT_CLI, modelInvariants, quintModuleName } from './src/simulate';
import { verifyPhases } from './src/verify-phases';
const specPath = resolve(process.env.SPEC ?? '../../specs/matchmaking/matching.qnt');
const source = readFileSync(specPath, 'utf8');
const conc = Number(process.env.CONC ?? 4);
const only = (process.env.CASES ?? '').split(',').filter(Boolean).map(Number);
const mod = quintModuleName(specPath);
const phases = verifyPhases({ source, module: mod, invariants: modelInvariants(source), maxSteps: 1, inductiveInvariant: '_proof', separateInduction: true })
  .filter((p) => (p.name === 'preservation' && (only.length === 0 || only.includes(p.case!))) || (p.name === 'initial' && process.env.INIT));
const out = `/tmp/mmprof-${process.env.TAG ?? 'x'}`;
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const apalache = resolveApalache(process.env) as { home: string };
const env = verifyEnv({ env: process.env, quintHome: linkQuintHome(out, apalache.home) });
const t0 = performance.now();
let next = 0;
const ms = (line: string) => { const m = /T(\d+):(\d+):(\d+),(\d+)/.exec(line)!; return ((+m[1]! * 60 + +m[2]!) * 60 + +m[3]!) * 1000 + +m[4]!; };
async function one(phase: (typeof phases)[number]) {
  const dir = join(out, `case-${phase.case ?? 'init'}`); mkdirSync(dir, { recursive: true });
  const cfg = join(dir, 'cfg.json');
  const pres = phase.name === 'preservation';
  writeFileSync(cfg, JSON.stringify({ checker: { ...(process.env.ENC ? { 'smt-encoding': { type: 'fun-arrays' } } : {}), tuning: { 'search.invariant.mode': pres ? 'after' : 'before', ...(pres ? { 'search.invariantFilter': '1->.*' } : {}) } } }));
  const t = performance.now();
  const run = await runQuint({ cwd: dir, env, timeoutMs: Number(process.env.TMO ?? 900_000), args: [QUINT_CLI, 'verify', specPath, '--main', mod, '--max-steps', String(phase.maxSteps), '--apalache-config', cfg, '--apalache-version', APALACHE_VERSION, '--server-endpoint', `127.0.0.1:${await freePort()}`, '--invariants', ...(process.env.COMBINE && phase.invariants.length > 1 ? [`not(or { ${phase.invariants.map((t) => `not(${t})`).join(', ')} })`] : phase.invariants), ...(phase.init ? ['--init', phase.init] : []), ...(phase.step ? ['--step', phase.step] : [])] });
  const secs = ((performance.now() - t) / 1000).toFixed(1);
  const logs: string[] = [];
  const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'detailed.log') logs.push(p); } };
  walk(join(dir, '_apalache-out'));
  const lines = logs.length ? readFileSync(logs[0]!, 'utf8').split('\n') : [];
  const detail: string[] = [];
  let start = 0; let trans = 0;
  for (const l of lines) {
    if (l.includes('Translating to SMT') && !trans) trans = ms(l);
    const c = /Checking state invariant (\d+)/.exec(l); if (c) start = ms(l);
    const h = /state invariant (\d+) holds/.exec(l);
    if (h) { const d = (ms(l) - start) / 1000; if (d >= 2) detail.push(`    inv ${h[1]} ${d.toFixed(1)}s ${phase.invariants[+h[1]!]?.replace(/\s+/g, ' ').slice(0, 110) ?? ''}`); }
  }
  const verdict = run.timedOut ? 'TIMEOUT' : run.code === 0 ? 'ok' : `FAIL ${run.output.includes('An example execution') ? run.output.slice(run.output.indexOf('An example execution'), run.output.indexOf('An example execution') + 1500) : run.output.split('\n').filter((l) => !/\s[DIWE]@\d/.test(l)).slice(-25).join('\n')}`;
  console.log(`case ${phase.case ?? 'init'} (${phase.invariants.length} targets): ${secs}s ${verdict}\n${detail.join('\n')}`);
}
await Promise.all(Array.from({ length: conc }, async () => { while (next < phases.length) await one(phases[next++]!); }));
console.log(`TOTAL ${((performance.now() - t0) / 1000).toFixed(1)}s`);
