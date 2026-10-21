You are operating in goal mode inside an existing SaaS repository.

MISSION

Make this product reliable, self-explanatory, and self-service enough to operate at substantial user volume without a dedicated support team.

We have no resources to handle routine support tickets, explain how the product works, repair ordinary user mistakes, manually reconcile normal account states, or investigate problems individually for customers.

Some necessary capabilities already exist, but they may be incomplete, inconsistent, poorly integrated, or insufficiently tested. Discover what exists, improve it, and close the gaps. Do not assume that the presence of a feature, test, dashboard, or documentation page means the underlying requirement is satisfied.

This is an implementation assignment, not a request for recommendations or an audit report alone.

The central product requirement is:

“A user can understand what to do, complete their task, understand what happened, and safely recover from expected problems without contacting us.”

Treat zero routine support as a design constraint—not as a claim that outages, security incidents, or every exceptional circumstance can be eliminated.

OPERATING RULES

- Inspect the actual repository, running application, tests, infrastructure configuration, and available telemetry before deciding what to change.
- Reuse and strengthen the existing architecture, UI system, providers, conventions, and deployment model.
- Prefer removing the cause of confusion or failure over documenting a workaround.
- Prefer the smallest coherent solution that closes a real gap. Do not build a new platform, introduce unnecessary services, or rewrite working systems.
- Do not replace unfinished workflows with a chatbot, helpdesk, ticket form, “contact support,” or a manual administrator procedure.
- Preserve legitimate product functionality. Do not make the audit pass by deleting core workflows, weakening security, loosening permissions, or hiding errors.
- Work autonomously through ordinary implementation decisions. Document reasonable assumptions and continue; do not stop after producing a plan.
- Never fabricate test results, production verification, usability research, traffic capacity, or completed integrations.
- Stay within authorized environments. Do not modify real customer subscriptions, send bulk communications, delete production data, run destructive migrations, or load-test production without explicit authorization.
- When credentials, permissions, external configuration, or unavailable tools prevent a step, complete everything else and identify the precise blocker. Do not pretend the blocked capability works.

1. ESTABLISH THE ACTUAL PRODUCT AND ITS FAILURE SURFACE

First discover:

- Intended users, their technical ability, and their primary jobs to be done.
- Critical journeys from first visit through first useful result, repeated use, account management, and leaving the product.
- Screens, forms, background jobs, external integrations, account states, permission boundaries, billing states, and data lifecycle.
- Existing support links, documentation, recovery tools, monitoring, tests, backups, and deployment safeguards.
- Any normal operation that currently depends on someone inspecting a database, running a repair script, changing an account manually, or explaining an undocumented rule.

Run the application and inspect the important journeys rather than relying only on source code or documentation.

Create a compact, maintained readiness matrix in the repository:

Journey → expected outcome → likely failure/confusion → existing behavior → gap → implemented resolution → verification evidence → remaining limitation.

Prioritize work in this order:

1. Data loss, unauthorized access, incorrect charges, and unrecoverable account states.
2. Broken critical journeys and states requiring manual intervention.
3. Confusing interactions, missing feedback, and incomplete self-service.
4. Detection, recovery, deployment, and scale weaknesses.
5. Secondary polish.

Use applicability judgments. Do not introduce organizations, payments, background jobs, or other capabilities the product does not need merely to satisfy a generic checklist.

2. MAKE THE PRODUCT EXPLAIN ITSELF

For each important screen and workflow, make these questions answerable from the interface:

- What is this for?
- What should I do next?
- What information do I need?
- What will happen when I act?
- Did it work?
- Where is my result?
- How can I correct a mistake?

Implement clear, consistent language and interaction patterns using the existing design system.

Address, where applicable:

- Useful empty states with a meaningful next action.
- Explicit labels, examples, units, constraints, and sensible defaults.
- Clear distinctions between optional and required information.
- Validation that prevents mistakes and preserves entered information.
- Visible loading, saving, saved, processing, success, and failure states.
- Explanations for disabled actions and unavailable capabilities.
- Clear differences between “no data,” “no matching results,” “still loading,” and “failed to load.”
- Plan limits and permissions explained before users invest effort in unavailable actions.
- Results that are easy to find after navigation, refresh, or returning later.
- Confirmation or undo appropriate to the consequence of an action.
- Keyboard access, understandable focus behavior, readable text, usable touch targets, and errors that do not rely only on color.
- Layouts that work on the devices and screen sizes the actual audience uses.

Keep help close to the decision it explains. Put essential instructions in visible text rather than requiring users to discover a tooltip, watch a tour, or search documentation.

Do not solve confusing interaction design by writing more documentation.

3. MAKE EXPECTED FAILURES SAFE AND RECOVERABLE

For critical workflows, explicitly consider:

- Slow, interrupted, or unavailable networks.
- Refresh, navigation away, browser closure, and session expiration.
- Double-clicks, repeated submissions, retries, and multiple tabs.
- Delayed responses and ambiguous outcomes.
- Concurrent edits and stale data.
- External provider outages.
- Interrupted or stuck background processing.
- Invalid inputs, exceeded limits, and changed permissions.

Implement appropriate safeguards using existing infrastructure.

Required outcomes:

- Recoverable failures do not unnecessarily destroy user work.
- Repeating a request does not accidentally duplicate consequential side effects.
- An interrupted response does not cause the interface to falsely claim that an operation failed or succeeded.
- Users can determine the authoritative status of consequential operations.
- Retrying, canceling, correcting, or resuming is available when safe.
- A workflow cannot remain indefinitely on an unexplained spinner.
- Permanent failures are distinguishable from temporary failures.
- Automatic retries are bounded and appropriate to the operation.
- Conflicting edits do not silently overwrite important work.
- Partial success is represented honestly, with a clear path forward.

Where drafts or autosave are appropriate, make persistence and recovery reliable. Distinguish “saved on this device” from “saved to your account.” Do not display “saved” before the promised persistence actually occurred.

Do not indiscriminately store sensitive information in browser storage. Respect account boundaries, shared-device risks, retention, and logout behavior.

For consequential actions such as payments or submissions, handle “the request may have succeeded, but the response was lost” explicitly. Check authoritative state before encouraging a potentially duplicative action.

For background jobs, provide understandable status, results, failure reasons, and safe recovery. Detect abandoned or stuck work. An unmonitored failed-job queue is not a completed recovery strategy.

4. COMPLETE SELF-SERVICE ACCOUNT AND BUSINESS WORKFLOWS

Users should not need staff for ordinary lifecycle operations.

Audit and complete applicable capabilities such as:

- Sign-up, verification, sign-in, sign-out, and expired-session recovery.
- Secure account recovery through supported, verified mechanisms.
- Updating account details.
- Understanding access restrictions.
- Invitations, membership management, and ownership changes if supported.
- Viewing current plan, usage, limits, renewal details, and relevant charges.
- Updating payment methods and accessing invoices or receipts.
- Upgrading, downgrading, and canceling subscriptions.
- Understanding when subscription changes take effect.
- Recovering from failed payments.
- Exporting data and requesting or completing account deletion.
- Correcting, undoing, or restoring ordinary user mistakes.

Use existing identity and billing providers’ self-service capabilities where suitable. Do not create redundant custom systems without a demonstrated need.

Ensure billing and entitlement state remain consistent when callbacks are delayed, duplicated, retried, or received out of order. The user must be able to distinguish pending synchronization from a completed change.

Explain the consequences of cancellation, deletion, downgrade, and ownership changes before execution.

Never weaken identity verification, tenant isolation, or authorization to make recovery easier. Never silently award access or alter money-related records just to resolve an inconsistency.

If an exceptional case cannot be safely self-served, document the limitation honestly and determine whether the affected capability must be restricted or remain a launch blocker. Do not disguise it as complete behind “contact support.”

5. MAKE ERRORS USEFUL WITHOUT CREATING TICKETS

Every important recoverable error should communicate, as applicable:

- What happened, in plain language.
- Whether the user’s work is safe.
- Whether the operation succeeded, failed, or has an unknown outcome.
- What the user can do next.
- Whether the system is already retrying.
- When another attempt is appropriate, if that is actually known.

Do not promise recovery times without evidence. Do not expose stack traces, secrets, or internal implementation details.

Replace generic error dead ends with the correct action: correct input, reconnect, reauthenticate without losing work, inspect status, retry safely, choose a supported alternative, or return to a valid state.

Automatically capture privacy-conscious diagnostics for unexpected failures. Include enough context to correlate the workflow, operation, release, and affected component without recording unnecessary user content or credentials.

Users should not have to collect logs, reproduce a developer environment, or explain technical details before the system can detect a problem.

Provide a copyable diagnostic reference where useful, but do not make submitting that reference a prerequisite for recovery.

Preserve an appropriate route for security reports and exceptional serious incidents. Do not create a staffed-helpdesk dependency or advertise response commitments we cannot meet.

6. DETECT AND CONTAIN PROBLEMS WITHOUT WAITING FOR USERS

Improve observability around user outcomes, not just server uptime.

For each critical journey, establish practical signals for:

- Successful completion.
- Unexpected failure.
- Excessive delay.
- Stuck or abandoned processing.
- Repeated retries.
- Relevant dependency failures.
- Meaningful data or entitlement inconsistencies.

Reuse existing monitoring and telemetry. Avoid duplicate systems and unnecessary sensitive data collection.

Implement safe synthetic checks for critical deployed behavior where the environment permits. A health endpoint alone is insufficient evidence that a user can complete the product’s main task.

Synthetic activity must use isolated test identities/data, avoid real charges and customer messages, and clean up safely.

Make alerts actionable, deduplicated, and proportional to user impact. Avoid one notification per failed request and noisy alerts with no defined response.

Where appropriate, provide an honest status surface or in-product incident message so users can distinguish an outage from a mistake they made.

Automate safe, well-understood recovery where feasible. Do not build uncontrolled “self-healing” that repeatedly mutates data or hides the underlying failure.

Create concise operational procedures for exceptional incidents. These are for rare operator intervention, not ordinary product use.

7. PROTECT DATA AND MAKE RELEASES SAFE

Verify that data protection and deployment safeguards actually work.

As applicable:

- Backups exist, their scope and retention are understood, and recovery has been exercised in an isolated environment.
- Recovery expectations are documented, including acceptable data loss and recovery time.
- User-level correction or restoration does not depend on restoring the entire production database.
- Schema and application changes account for compatibility during deployment.
- Releases have meaningful automated gates.
- Post-deployment checks cover critical journeys.
- Broken changes can be contained through the existing rollback, feature-disable, or forward-fix mechanism.
- Rollback does not assume that destructive schema changes or external side effects can be undone.
- Failure in an optional integration does not unnecessarily disable unrelated functionality.
- Secrets, diagnostic data, exports, and administrative recovery actions are protected appropriately.

A backup configuration is not restore evidence. A rollback document is not evidence that rollback works.

Validate what can safely be validated. Report unverified production capabilities explicitly.

8. ACCOUNT FOR MANY USERS WITHOUT ADDING MANY OPERATORS

Inspect the paths most likely to turn growing usage into growing support work:

- Concurrency and race conditions.
- Tenant isolation.
- Resource limits and provider quotas.
- Slow or unbounded queries and oversized result sets.
- Queue backlogs and stuck processing.
- Rate limiting, abuse, and notification volume.
- Expensive retries and repeated requests.
- Unbounded logs or telemetry costs.
- Manual provisioning and per-customer maintenance.

Implement proportionate protections supported by the current architecture.

Users must receive understandable behavior when capacity, usage, or plan limits are reached. Preserve work and explain the next available action rather than exposing infrastructure errors.

Run bounded, representative performance and concurrency tests in a safe environment. Record the workload and observed limits.

Do not claim arbitrary scalability or invent a user-count guarantee. Identify actual bottlenecks and external constraints.

Prefer solutions where normal growth does not require manual repair, per-customer configuration, or introducing additional operational systems.

9. REQUIRE EVIDENCE, ESPECIALLY FOR BUG FIXES

For each reproducible bug fixed:

1. State the observed behavior and expected behavior.
2. Reproduce it with a focused automated test that fails for the relevant reason.
3. Fix the underlying cause.
4. Demonstrate that the same test passes.
5. Check adjacent behavior for regressions.

Do not weaken assertions, remove failing tests, or mock away the failure merely to obtain a green suite.

Use the cheapest reliable test layer for each behavior:
- Unit and property tests for rules and invariants.
- Integration tests for persistence, permissions, and provider boundaries.
- End-to-end tests for critical user journeys.
- Browser evidence for important interface changes.

Exercise relevant failure paths, not only happy paths. Include interruption, retries, duplicate actions, expired sessions, permission changes, and delayed processing where they can affect the feature.

Verify desktop and mobile behavior where relevant. Check keyboard interaction and accessible error presentation.

Do not treat screenshots as functional proof or passing tests as proof of universal correctness.

Do not claim that the product is self-explanatory to real users solely because an agent completed a browser walkthrough. Use a structured usability review and instrument friction where appropriate; distinguish those checks from actual user research.

Follow existing CI conventions. Keep fast blocking checks focused and place expensive, broad checks in the appropriate scheduled or release workflows. Do not make development impractically slow or introduce flaky gates.

10. MAKE THESE STANDARDS PERSIST

Add or improve one canonical product-quality standard in the repository and reference it from the existing agent/developer instructions.

For future customer-facing changes, define completion to require applicable evidence for:

- Clear user intent and next action.
- Loading, empty, success, invalid-input, and failure behavior.
- Preservation of user work.
- Secure permissions and account boundaries.
- Safe retries and interruption handling.
- Self-service correction and recovery.
- Useful diagnostics and production signals.
- Automated acceptance and regression tests.
- Compatible deployment and data lifecycle behavior.

Integrate enforceable requirements into tests and CI where practical. Documentation alone must not be the only enforcement mechanism.

Do not generate a large collection of redundant policy documents. Keep standards concise, discoverable, and tied to actual behavior.

Track a small number of useful support-prevention indicators using existing tooling where possible, such as:
- Critical-journey completion and failure rates.
- New-user completion of the first useful task.
- Repeated retries or validation failures.
- Recovery success and stuck operations.
- Account or billing actions that still require operator intervention.

Define measurement boundaries and distinguish measured results from proposed targets. Do not invent production baselines or claim that lack of support tickets proves lack of user problems.

DEFINITION OF DONE

This assignment is complete only when:

- The important product journeys have been inspected and recorded.
- Applicable high-priority gaps have been implemented, not merely described.
- Ordinary expected failures have a safe, understandable self-service outcome.
- Normal account and business operations do not depend on staff.
- Critical bug fixes have meaningful regression evidence.
- Important failures are observable without a customer reporting them.
- Recovery and deployment safeguards have been tested to the extent authorized.
- The interface and documentation describe actual behavior truthfully.
- Existing legitimate functionality and security boundaries remain intact.
- The repository contains a maintained readiness matrix and enforceable quality expectations.
- Remaining external blockers and unavoidable exceptional cases are explicit.

If a requirement cannot be completed, do not label it done. State what is missing, its user impact, the exact external action required, and whether it blocks release.

FINAL REPORT

At the end, provide:

1. What changed, grouped by user outcome.
2. Which sources of routine support dependency were eliminated.
3. Tests and checks actually run, with results.
4. Before/after browser evidence for important UX changes, where available.
5. Recovery, deployment, and scale evidence.
6. Remaining risks, external blockers, and exceptional cases.
7. An honest readiness assessment: ready for self-service operation within stated limits, or not ready with specific reasons.

Do not finish with recommendations in place of work that you could have performed.

Begin by inspecting the repository and running the product. Then implement, verify, and continue until the completion criteria are met or only genuine external blockers remain.