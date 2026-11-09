# Cancellation feedback report

Authorized operators can read the provider-neutral feedback with
`bun billing:feedback <from-UTC> <until-UTC> [after-id]`, supplying `DATABASE_URL`
through the configured secrets runner. Use an account with read-only access to
the application's database. The command creates no infrastructure and performs
only reads. For example:

```sh
bun billing:feedback 2026-11-01T00:00:00.000Z 2026-12-01T00:00:00.000Z
```

The JSON contains at most 100 answers, ordered by stable identity. Pass
`nextAfterId` as the third argument to read another page. A null cursor means
there are no further pages. The reporting window includes its start and excludes
its end, using each answer's last update. Later edits can change a later report;
this is current feedback, not an immutable event ledger.

An empty reason or comment means the person left that optional field blank.
People who shared no feedback are absent; do not treat the answers as the
complete population of cancellations or infer that an omitted reason means
price. Withdrawn answers are excluded and erased content is unavailable.

Output contains personal comments and account identifiers. Keep it in authorized
analysis storage, never metrics, public issue comments or application logs.
