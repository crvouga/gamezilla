# Synthetic Population Worker capacity measurement

The automated `benchmark` script runs the normal backend, a separate Synthetic Population
Worker process, and isolated application realms with development UI hooks off.
It increases the desired synthetic population through 1, 2 and 4 Synthetic Users. Each
stage includes a six-second warm-up and a six-second resource sample, at a
500-millisecond behavior interval. Authentication batch time includes worker
assignment, cold module loading and ordinary UI authentication.

Measured on this development machine with Bun 1.4.2, 2026-10-10 UTC:

| Concurrent Synthetic Users | Worker resident memory | Sampled CPU cores | Authentication batch | Errors / recovering |
| --- | --- | --- | --- | --- |
| 1 | 171 MiB | 0.068 | 5,372 ms | 0 / 0 |
| 2 | 382 MiB | 0.340 | 5,036 ms | 0 / 0 |
| 4 | 869 MiB | 0.739 | 3,299 ms | 0 / 0 |

All four users were playing at the last sample. The baseline worker used
35 MiB. Module transforms are included; the backend's resources are excluded.
Run `bun run --filter @apps/synthetic-population-worker-ts benchmark` to reproduce the
measurement against a fresh, isolated local backend. It needs no cloud secrets
and cannot select a production API.

Railway remains configured for one Synthetic User per replica, one vCPU and
2 GiB. This short local run does not establish Railway capacity or sustained
memory use. A longer soak, event-loop delay, individual action/authentication
latency distributions, matchmaking latency, recovery duration and lease
contention measurements remain necessary before raising that limit. The
benchmark reports failed and recovering users alongside resource results.

An earlier four-user run failed because behavior read a development-only board
probe. The regression now runs the native application with those hooks disabled;
gameplay reads the board's existing production attributes through the UI Driver.
