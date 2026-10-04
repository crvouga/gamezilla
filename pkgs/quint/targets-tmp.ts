import { readFileSync } from 'node:fs';
import { modelInvariants } from './src/simulate';
import { verifyPhases } from './src/verify-phases';
const source = readFileSync(process.env.SPEC!, 'utf8');
const phases = verifyPhases({ source, module: 'matching', invariants: modelInvariants(source), maxSteps: 1, inductiveInvariant: '_proof', separateInduction: true });
const p = phases.find((x) => x.case === Number(process.env.CASE))!;
p.invariants.forEach((t, i) => console.log(i, t.replace(/\s+/g, ' ').slice(0, 150)));
