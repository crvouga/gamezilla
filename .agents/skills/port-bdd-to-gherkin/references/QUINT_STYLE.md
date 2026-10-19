# Quint models and bindings

## When a legacy test becomes a model

- `test.each` over seeds, or a seed loop that asserts convergence or an
  invariant.
- `s.randomActions`, `system.explore`, `product-explore`, `test:fuzz`, or any
  "monkey".
- A claim phrased "no matter the order", "under any interleaving", or
  "never".

A random walk that only verifies "didn't crash" or the standing
`defineProperty` verifications becomes a model whose `observe` compares the
product's state to the model's after **every** step. That makes it a much
stronger test than the one it replaces.

## Model shape

```quint
// Becoming friends, and no longer.
//
// <Plain product language: who is in it, what they can do, what they see.>
module friendship {                      // file friendship.qnt → module friendship
  type Person = str
  pure val PEOPLE: Set[Person] = Set("alice", "bob", "carol")

  /// What each person sees of each other person.   ← observable state only
  var sees: Person -> (Person -> Tie)
  var friends: Set[Set[Person]]

  action update(newFriends: Set[Set[Person]]): bool = all {
    friends' = newFriends,
    sees' = PEOPLE.mapBy(p => ...),      // derived observable: one helper updates it
  }

  action init = update(Set())

  action accept(person: Person, other: Person): bool = all { ... }

  action step = {
    nondet person = PEOPLE.oneOf()       // nondet names = binding pick names
    nondet other = PEOPLE.exclude(Set(person)).oneOf()
    any { accept(person, other), remove(person, other), ... }
  }

  val invNoSelfFriendship = friends.forall(f => f.size() == 2)
}
```

- The file is kebab-case and the module is the same name in snake_case.
- The header comment is product language, readable without the code.
- State variables are things a person or client can **observe**. Keep
  implementation detail (queues, epochs, row versions) out of the model unless
  it is the package's public surface.
- Use small finite domains (2–3 actors, a handful of ids). Traces should stay
  short and every action reachable.
- Invariants are named `val inv<Name>`. Port every standing
  `defineProperty` claim that can be observed.
- Gotchas: `x' = a and b` parses as `(x' = a) and b`, so bracket the
  right-hand side. `next` is a builtin, so no action can take that name. An
  unsatisfiable `init` draws empty traces, and the runner rejects it.
- Tooling: `quint typecheck m.qnt`, and
  `quint run --mbt --backend=typescript m.qnt`. **Always** pass
  `--backend=typescript`, because the Rust backend downloads a binary, and
  gates run offline. `typecheck` rejects `--backend`. The seed is `FC_SEED`
  (default `424242`), and `PBT_RANDOM=1` explores other seeds.

## Binding

```ts
bindQuintModel<World>({
  model: 'friendship',
  traces: 8,
  maxSteps: 12,
  actions: {
    init: async (w) => { /* sign everyone in via s.apply */ },
    accept: async (w, picks) => w.s.apply(acceptFriendRequest, String(picks['person']), String(picks['other'])),
    // one entry per model action — no more, no fewer
  },
  observe: async (w) => ({ sees: /* read back via s.read, never acting */ }),
});
```

- Every action goes through `s.apply`, so system properties hold after each
  step and the report records it.
- `observe` only reads. It is compared with the model's state on the harness's
  virtual clock (settling for up to about 15 s), so asynchronous convergence
  gets real-world patience.
- Replay needs steps whose timing the driver can pin. If the product has
  concurrency the driver can't control (for example, several owed retries at
  once), model it as an explicit action with at most one outstanding at a
  time.
- A bound action that no trace takes fails the suite. Raise the `traces` or
  `maxSteps` count, or fix the guard.
- On divergence the runner prints the step, the differing variables (model vs
  product), and the harness calls. Decide whether the product or the model is
  wrong. Never loosen `observe` to hide a difference.
