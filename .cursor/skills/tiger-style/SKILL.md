---
name: tiger-style
description: Apply Tiger Style — the rigorous, safety-first systems programming discipline pioneered at TigerBeetle. Use this skill whenever the user asks to write, review, or refactor systems-level code (C, Zig, Rust, Go, or any language where correctness and performance matter critically), mentions "Tiger Style", wants safety guarantees baked into code, is writing storage engines, databases, financial systems, or network servers, or asks for help with assertions, invariants, error handling philosophy, or code clarity at a high standard. Also trigger when the user mentions TigerBeetle, asks about zero-allocation patterns, wants to eliminate undefined behavior, or asks how to write "correct by construction" code. This skill enforces a complete philosophy — trigger it even for partial tasks like "add assertions to this function" or "review my error handling."
---

# Tiger Style

Tiger Style is the coding discipline developed at [TigerBeetle](https://github.com/tigerbeetle/tigerbeetle). It is a complete philosophy for writing correct, fast, and safe systems code — not a style guide. The core premise: **safety and performance are not in tension. Asserting invariants and eliminating undefined behavior makes code faster, not slower.**

Read the [official Tiger Style doc](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) if you need full depth. This skill captures the actionable principles.

---

## The Four Pillars

### 1. Safety First

- **Assert everything, everywhere.** Assertions are not debug aids — they are load-bearing. They should fire in production. An assertion that never fires is still worth writing because it documents an invariant.
- **Eliminate undefined behavior completely.** No signed integer overflow, no out-of-bounds reads, no use-after-free, no uninitialized memory. These are not performance trade-offs. They are correctness bugs.
- **Fail loudly, never silently.** On invariant violation, crash. Do not try to recover from the unrecoverable. Silent data corruption is worse than a crash.
- **Handle every error.** There is no "this can't happen." If a function returns an error, that error must be explicitly handled or explicitly forwarded with a comment explaining why.

### 2. Performance by Design

- **Zero allocations in the hot path.** Allocate at startup or at well-defined boundaries. Use fixed-size buffers, arenas, and pools. Dynamic allocation during steady-state operation is a design smell.
- **Measure before optimizing.** Intuition about bottlenecks is usually wrong. Benchmark. Profile. Then optimize.
- **Design for the cache.** Prefer sequential memory access. Struct-of-arrays over array-of-structs where performance matters. Avoid pointer chasing.
- **Avoid syscalls in the hot path.** Batch I/O. Use io_uring or equivalent where available. One syscall per logical operation is often too many.

### 3. Explicit Over Implicit

- **No hidden control flow.** Exceptions, implicit conversions, and "magic" behavior obscure what code actually does. Make every branch, every conversion, every allocation visible at the call site.
- **Caller allocates, callee fills.** Functions that need a buffer take the buffer as a parameter. They do not allocate internally. This makes ownership clear and eliminates hidden allocation.
- **No null where absent is meaningful.** Use tagged unions / optionals / result types explicitly. Null is not a value — it is the absence of a value, and that absence must be handled.
- **Comptime / static where possible.** Configuration, table sizes, protocol limits — make them compile-time constants, not runtime parameters.

### 4. Simplicity as a Requirement

- **Complexity is a bug.** If the code is hard to read, it is wrong. Rewrite it until it is obvious.
- **One function, one job.** Functions that do two things should be two functions.
- **Name things after what they are, not what they do.** A buffer is `write_buffer`, not `do_write`. A count is `replica_count`, not `get_replica_count()`.
- **Comments explain why, not what.** If you have to explain what the code does in a comment, rewrite the code. Comments explain invariants, non-obvious constraints, and the reasoning behind choices.

---

## Assertion Patterns

Assertions in Tiger Style are typed by what they protect:

```zig
// Invariant: must always hold; crash if violated
assert.true(self.state == .ready);

// Precondition: caller's responsibility
assert.true(buffer.len > 0);
assert.true(offset + length <= self.size);

// Postcondition: callee's guarantee
defer assert.true(self.state != .corrupted);

// Unreachable: documents that a branch cannot be taken
// Use your language's equivalent: unreachable, std::abort(), etc.
else => unreachable,
```

**Assert at the boundary of trust.** When data crosses a trust boundary (network, disk, user input), validate and assert before using it. Inside the trust boundary, assert invariants; don't re-validate.

---

## Error Handling Philosophy

```zig
// BAD: swallowing errors
const result = try do_thing() catch {};

// BAD: logging and continuing
if (err) |e| {
    log.err("something went wrong: {}", .{e});
    // continues anyway
}

// GOOD: propagate or crash
const result = try do_thing();          // propagate
const result = do_thing() catch unreachable; // "cannot happen" — document why
```

**Errors are part of the type system, not exceptions.** Every error code or error union value must be matched. Adding a new error to an enum must break callsites — that's the point.

---

## Memory Rules

| Situation               | Rule                                                    |
| ----------------------- | ------------------------------------------------------- |
| Startup / init          | Allocate freely. Document max size.                     |
| Hot path (steady state) | Zero allocations. Use pre-allocated structures.         |
| Request handling        | Use a per-request arena, freed at request end.          |
| Cleanup                 | Free deterministically. No GC reliance for correctness. |

**Buffer sizing:** Always calculate worst-case sizes at comptime. If the size depends on runtime input, assert the input is within bounds before using it.

---

## Naming Conventions

```
// Types: PascalCase nouns
MessageHeader, ReplicaState, WriteBuffer

// Functions: snake_case verb phrases
write_message(), advance_prepare_timeout(), assert_valid_header()

// Constants: SCREAMING_SNAKE or comptime-known values clearly named
const replicas_max = 6;
const sectors_per_block = 8;

// Boolean: is_, has_, can_ prefix
is_dirty, has_quorum, can_commit

// Counts vs indices: be explicit
replica_count  (how many)
replica_index  (which one, 0-based)
replica_id     (stable identifier, not positional)
```

---

## Code Review Checklist

When reviewing code under Tiger Style:

- [ ] Every function has assertions for its preconditions
- [ ] Every error return is explicitly handled
- [ ] No allocation in steady-state / hot path
- [ ] No undefined behavior (overflow, OOB, uninit)
- [ ] Failure mode is crash, not silent corruption
- [ ] Buffer sizes are proven at comptime or asserted at runtime
- [ ] No implicit conversions between numeric types without explicit cast + assertion
- [ ] Functions have exactly one responsibility
- [ ] Names are precise: no ambiguous abbreviations, no `data`, `info`, `handle`
- [ ] Comments explain invariants and why, not what

---

## Applying Tiger Style to a Review

When the user asks to review or rewrite code:

1. **Identify trust boundaries** — where does unvalidated data enter?
2. **Find unhandled errors** — grep for ignored return values, bare `_` assignments
3. **Find assertions that are missing** — what invariants does this code assume but not state?
4. **Find allocations** — are any in the hot path?
5. **Check naming** — are types, counts, and indices clearly distinguished?
6. **Check function scope** — does each function do one thing?
7. **Check failure behavior** — on error, does it crash loudly or degrade silently?

Write the review as a concrete list of changes, not general advice. Each item should reference the specific line or pattern and state exactly what to change and why.

---

## Language-Specific Notes

**Zig** (native Tiger Style language): use `assert`, `unreachable`, comptime, error unions natively. Leverage `@setRuntimeSafety(true)` in production builds.

**Rust**: use `assert!` / `debug_assert!`, `Result<T,E>` over `Option` where error information matters, `#[must_use]`, avoid `.unwrap()` except where truly unreachable (document it).

**C**: use a project-wide `ASSERT` macro that calls `abort()`. Enable `-fsanitize=undefined,address` in CI. Use `__attribute__((warn_unused_result))` on fallible functions.

**Go**: return errors always; never `_` an error in production code. Use `log.Fatal` or `panic` for invariant violations, not for expected errors.

---

## References

- [TigerBeetle TIGER_STYLE.md](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) — the canonical source
- [TigerBeetle source code](https://github.com/tigerbeetle/tigerbeetle/tree/main/src) — reference implementations in Zig
