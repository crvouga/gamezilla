# CI notifications

GitHub's repository webhook delivers completed main-branch runs of Release,
Verify Nightly and Verify PR directly to the existing IRM push chain. Health
is not among them: its check results already reach IRM as Grafana alerts, so
a red hourly Health run would only repeat them.
Failures, timeouts, required action and startup failures notify the responder's
mobile app with a link to the run, including failures before workflow setup.
Pull requests, branch rehearsals, progress, skipped runs and cancellations never
notify. Delivery does not depend on a step in the failing workflow.

Each run has its own alert group. Fix the cause shown in the linked failed jobs,
then rerun the failed run; a successful rerun resolves its alert. A different
successful run does not dismiss an earlier failure. Acknowledgement and manual
resolution remain available in IRM. GitHub webhook delivery failures can be
inspected and redelivered from the repository's webhook delivery history.

This is provisioned by the scoped alerting apply when `alerting.irm_responder`
is configured, alongside mobile delivery. The scoped repository-policy apply
deliberately cannot change it. The webhook URL is a credential stored only in
GitHub's hook configuration and encrypted OpenTofu state.
