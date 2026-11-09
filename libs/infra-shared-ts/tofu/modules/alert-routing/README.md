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

After the main-branch alerting apply, Release runs the uncached
`@libs/infra-server-ts#check:alert-delivery` operational check. It reads the
applied connection details from encrypted state without printing them and:

1. Reads this repository's actual webhook and requires an active `workflow_run`
   subscription pointing at the applied integration.
2. Resolves the configured IRM user ID back to the expected username.
3. Posts a clearly titled **Alert delivery check** failure to that integration,
   linked to the real Release run. Its run ID has a separate canary namespace,
   so recovery cannot resolve a real CI failure.
4. Requires the matching integration, route, title and source run URL, then a
   new mobile notification attempt and a subsequent successful notification
   outcome for that responder in the incident timeline. A queued attempt alone
   cannot pass. A reported personal-notification failure fails the check. The
   timeline's success message does not name its channel, so another channel's
   concurrent attempt makes the evidence ambiguous and fails verification.
   The normal rules place mobile first and wait one minute before any existing
   fallback rules, preserving those rules while making mobile's result attributable.
5. Sends a success payload even on failure, and, when the incident ID is known,
   requires the incident to resolve. Each observation phase has a 60-second
   deadline; each HTTP request has a 10-second deadline.

This sends a normal mobile notification on each release. A successful check is
evidence of the project integration, responder, mobile attempt and recovery.
It does **not** establish handset display/sound, Important-push behavior, a real
GitHub webhook delivery, or Grafana rule evaluation. It does not acknowledge
incidents or change infrastructure. Rehearsals plan the resources and run the
offline contract tests; they do not send production notifications.

The public IRM API supplies users and alert groups. The Grafana OnCall plugin's
read-only incident timeline supplies notification attempts
(`render_after_resolve_report_json`, `user_notification` realm). The check fails
closed if that API is unavailable, unauthorized or changes shape; it never
substitutes the existence of a personal notification rule for delivery evidence.
The first main-branch apply must establish this live API compatibility on the
configured stack. Until then this is implemented verification, not a delivery claim.
