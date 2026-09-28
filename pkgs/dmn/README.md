# @pkgs/dmn

Decision tables as the oracle for entitlements, permissions, feature gates
and usage limits ([`docs/SPEC_STRATEGY.md`](../../docs/SPEC_STRATEGY.md) § 5,
§ 4.1). A table in `specs/<context>/*.dmn` is checked on its own — well
formed, complete, consistent over its declared inputs — and then against the
implementation: every generated case is answered by the table and by each
implementation layer the product binds, and the answers must agree. This
package knows nothing about the product.

| Module | What it does |
| --- | --- |
| `xml` | A small strict XML reader (declaration, elements, attributes, text, CDATA, comments, the five named entities, character references). Refuses DOCTYPE and entity definitions; keeps prefixes and exposes `localName`; errors carry `line:column`. `escapeXml` is its inverse. |
| `feel` | The FEEL cells tables use: unary tests (`-`, literals, `< <= > >=`, `[a..b]` / `(a..b)` / `]a..b[`, `t1, t2`, `not(…)`) and literal outputs. `parseUnaryTests`, `parseLiteral`, `matches`. No coercion: `"20"` never matches `20`. |
| `domain` | An input's declared domain from `inputValues`: listed literals or a whole-number range `[0..1000]`. |
| `model` | `parseDmn(xml)` → decisions (DMN 1.3/1.4, matched by local name) or issues: missing `inputValues`, entry count mismatch, an output outside `outputValues`, unparseable FEEL, a literal outside its input's domain, a string compared by order, duplicate ids, unsupported hit policies. |
| `evaluate` | `evaluateDecision(decision, input)`: the reference answer under the hit policy (UNIQUE, FIRST, ANY, PRIORITY). Missing or unknown inputs and values outside the domain are errors. |
| `partition` | Each input's domain as classes no rule tells apart (listed values; number ranges cut at every threshold), which keeps the analysis exact and small. |
| `analyze` | `gaps(decision)` (combinations no rule answers) and `overlaps(decision)` (answered twice under UNIQUE; answered differently under ANY), each with a concrete witness input and its region. |
| `cases` | `generateCases(decision)`: every listed value × every number representative (domain min and max, 0 and 1, L-1 / L / L+1 for every threshold L), each with a stable id (`tier=guest/plays today=20`) and the expected answer. |
| `registry` | `bindDecisions({ spec, decisions?, layers, open?, close? })`: the implementation layers of one spec file. Each layer has `decide`, and optionally `observes` (outputs it can see) and `applies` (inputs it governs). |
| `compare` | `compareLayer({ decision, cases, layer, world? })` → `{ checked, mismatches }`, the comparison the runner uses; product packages run their mutation tests with it. `bindingProblems`, `formatMismatches`. |
| `bun-test` / `stubs` | `runDecisionSpec(…)`: one `describe` per file — `is well-formed`, per decision `answers every case (complete)` and `never answers twice (consistent)`, `is bound to the implementation`, and per decision × layer `the <layer> agrees`. Records evidence (`kind: 'decisions'`) for every obligation. The generated stub per file (`billing-access.dmn.test.ts`). |

A layer that governs none of the generated cases fails: a dead adapter proves
nothing.

## A table

```xml
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="access-definitions" name="Access">
  <decision id="access" name="Access">
    <decisionTable id="access-table" hitPolicy="UNIQUE">
      <input id="tier" label="Tier">
        <inputExpression typeRef="string"><text>tier</text></inputExpression>
        <inputValues><text>"guest","free","plus"</text></inputValues>
      </input>
      <input id="plays-today" label="Plays today">
        <inputExpression typeRef="number"><text>plays today</text></inputExpression>
        <inputValues><text>[0..1000]</text></inputValues>
      </input>
      <output id="decision" name="decision" typeRef="string">
        <outputValues><text>"allow","deny"</text></outputValues>
      </output>
      <rule id="below-limit">
        <inputEntry><text>"guest","free"</text></inputEntry>
        <inputEntry><text>&lt; 20</text></inputEntry>
        <outputEntry><text>"allow"</text></outputEntry>
      </rule>
      <rule id="at-limit">
        <inputEntry><text>"guest","free"</text></inputEntry>
        <inputEntry><text>&gt;= 20</text></inputEntry>
        <outputEntry><text>"deny"</text></outputEntry>
      </rule>
      <rule id="plus">
        <inputEntry><text>"plus"</text></inputEntry>
        <inputEntry><text>-</text></inputEntry>
        <outputEntry><text>"allow"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>
```

Every input declares its domain; `plays today` is checked at 0, 1, 19, 20,
21 and 1000.

## A binding

`tests/decisions/access.binding.ts`, imported from `tests/decisions/index.ts`:

```ts
bindDecisions<Harness>({
  spec: 'access',
  open: () => openHarness(),
  close: (h) => h.dispose(),
  layers: {
    'application decision': {
      decide: (input, { world }) => world.can(input),
    },
    'server enforcement': {
      observes: ['decision'],
      decide: async (input, { world }) =>
        ({ decision: (await world.tryPlay(input)).ok ? 'allow' : 'deny' }),
    },
  },
});
```
