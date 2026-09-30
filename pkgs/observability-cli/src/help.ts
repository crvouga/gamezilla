export const HELP = `obs/v1
usage: bun obs <command> [arguments] [--source directory] [--json]

  person --name "..." --at "6:33pm MST" [--place "..."] [--timezone MST] [--window 30m]
  last [--window 10m] [--errors]       recent activity, errors first
  find <anything> [--window 24h]       resolve any correlation identifier
  user <user-id> [--at time]           ISO/unix/relative UTC (for example "yesterday 14:30")
  trace <trace-id>                     narrated trace
  span <trace-id> <span-id>            full detail for one span
  mutation <mutation-id>               mutation-correlated traces
  test <test-name>                     failing-test traces from artifacts
  errors [--since 1h] [--user id]      recent failures, optionally for one identity
  slow [--since 1h] [--p 95]           slowest traces
  diff <trace-a> <trace-b>              structural/timing comparison
  tail [--user <identity>] [--window 1m] bounded follow snapshot; rerun to follow
  schema                               live span/event/attribute vocabulary

exit codes: 0 found, 1 no match, 2 usage, 3 store unreachable`;
