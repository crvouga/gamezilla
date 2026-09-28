# @pkgs/property

`assertProperty` — the only way a property runs in this repo — plus fast-check
(`fc`) and JSON arbitraries. It pins the seed (`FC_SEED`, default `424242`) and
run count (`PBT_NUM_RUNS`, default `40`) identically on every machine, so a
property's verdict is a function of the code and the gate can cache it.
`PBT_RANDOM=1` (`bun run test:pbt:random`) hunts beyond the pinned seed.

A leaf over fast-check alone: pure packages property-test without depending on
the harness kernel, and packages the harness is built on (`@pkgs/uuid`) can use it
without a cycle. Raw `fc.assert` / `fc.check` / `fc.sample` / `fc.statistics`
are banned elsewhere (`no-unpinned-property.grit`). Policy:
[`docs/TESTING.md`](../../docs/TESTING.md).

```ts
import { assertProperty, fc } from '@pkgs/property';

assertProperty(
  'reverse is an involution',
  fc.property(fc.array(fc.nat()), (xs) => {
    expect([...xs].reverse().reverse()).toEqual(xs);
  })
);
```
