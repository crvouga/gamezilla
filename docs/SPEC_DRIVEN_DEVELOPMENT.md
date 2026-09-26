# Spec-driven development

Product acceptance behavior lives in Gherkin under the owning package's
`features/` directory. Code tests remain the right home for units, contracts,
properties, model walks, and framework mechanics.

## Roles

The spec writer edits only `.feature` files, generated step catalogs,
`GLOSSARY.md`, and documentation. They describe observable intent and never
read implementation or step-definition source. A spec commit starts with
`spec:` and never contains implementation files.

The implementer treats feature text as read-only. They add or reuse typed step
definitions and sim actions until the scenarios pass. If wording is missing or
ambiguous, they return that gap to the spec writer instead of silently changing
the feature.

The step auditor owns vocabulary quality: undefined, ambiguous, pending,
unused, UI-mechanical, and near-duplicate steps. The generated catalogs are the
public vocabulary for spec authors.

## Workflow

1. Read [`STEPS_CATALOG.md`](STEPS_CATALOG.md) and `GLOSSARY.md`.
2. Write intent-focused scenarios tagged with one `@domain:<domain>` and any
   relevant `@goal:<section>:<number>` tags.
3. Commit the feature-only change with a `spec:` subject.
4. Implement step definitions through exported sim actions and reads.
5. Run `bun run spec:check`, a focused `bun run spec --package <workspace>`,
   and finally `bun check`.

Useful commands:

```sh
bun run spec --tags '@goal:social:5'
bun run spec --package @libs/friends -t 'ends the friendship'
bun run spec:catalog
bun run spec:check
```

The package e2e runner generates temporary Bun test stubs in `.cache/spec/`.
Those files are never committed. Failures identify the feature line, matching
definition, completed-step ledger, and sim calls made by the failing step.
