# Alert delivery

Grafana and GitHub completion events retain their alert history in IRM's web
inbox. Both integrations have empty default routes and no escalation routes,
chains or personal notification rules. No alert sends a mobile push, critical
notification, email or phone escalation through these integrations.

Health, Release and Verify Nightly already upsert one GitHub issue per failing
workflow on main. Repeated failures update the open issue; the next successful
run closes it. Health includes objective failures from every environment and
links its logs and collected alert evidence. Issue reporting failures fail the
reporting step rather than silently dropping the notification.

The scoped alerting apply removes the former page and push routes, chains and
personal mobile rules. Integration history, dashboards and alert evaluation
remain available. GitHub notification preferences control notifications from
the issues themselves.
