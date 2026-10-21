export const HELP = `obs/v1
usage: bun obs <command> [arguments] [--source directory] [--json]

  person --name "..." --at "7pm MST"   everything one person did around a time:
         [--place "..."] [--window 30m]  accounts, problems first, then a timeline
         [--slow-ms 1000] [--all]
  last [--window 10m] [--errors]       newest activity, errors first
  find <anything> [--window 24h]       resolve any correlation identifier
  user <user-id> [--at time]           ISO/unix/relative UTC (for example "yesterday 14:30")
  trace <trace-id>                     narrated trace
  span <trace-id> <span-id>            full detail for one span
  mutation <mutation-id>               mutation-correlated traces
  test <test-name>                     failing-test traces from artifacts
  errors [--since 1h] [--user id]      every error trace, optionally for one identity
  slow [--since 1h] [--p 95]           slowest traces
  diff <trace-a> <trace-b>             structural/timing comparison
  tail [--user <identity>] [--window 1m] bounded follow snapshot; rerun to follow
  platform --service <worker-name>     retained Cloudflare runtime failures [--window 1h]
  schema                               live span/event/attribute vocabulary

--all lifts the search limit (last, errors, find, user, tail, slow) and prints
every problem and timeline row (person). A search that stops early says so.
exit codes: 0 found, 1 no match, 2 usage, 3 store unreachable`;
