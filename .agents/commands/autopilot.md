---
description: "Complete a supplied goal through persistent unattended work, making routine decisions without questions and continuing implementation, verification, and repair until done. Use for unattended runs or requests to keep working autonomously until a goal is achieved."
---

# /autopilot

Treat the supplied goal as an assignment to finish, not a request for a plan. Work for as long as completion requires within the runtime's actual limits. Do not impose a time-of-day deadline, arbitrary iteration cap, or token budget the user did not request. Finish early when the goal is achieved.

## Establish the run

- Read the applicable repository instructions and inspect existing work before editing. Preserve unrelated changes.
- Derive observable completion criteria from the goal and existing requirements. When details are missing, choose the smallest reasonable interpretation consistent with the user's intent; record the assumption and proceed without a clarification question.
- Record the authorized scope, acceptance verifications, and any explicit resource limits. An unattended run authorizes routine decisions needed for that goal; it does not grant unrelated permissions.
- When native persistent-goal tools are available, inspect the current goal and create the requested goal if none is active. Include completion criteria and the checkpoint path in its objective. Reuse a matching active goal; do not overwrite an unrelated unfinished goal. Follow the tools' documented status and budget rules. Editing or discussing this skill is not itself a request to start a goal.
- If persistent-goal tools are unavailable, keep working in the current session. Do not claim automatic continuation or restart support, invent a scheduler, or change approval settings to enable it.

## Keep working

Maintain a short queue of unmet completion criteria. Select the next useful action, execute it, inspect the result, and update the queue. Continue through implementation, necessary tests, debugging, and repair until every criterion has evidence.

Do not end a turn with a plan, a partial milestone, an offer to continue, or a question while useful authorized work remains. Routine choices about implementation, naming, test selection, and reversible fixes are yours to make. Do not use question or approval tools for those choices. Give brief progress updates under the host's communication rules without waiting for replies.

If an approach fails, inspect available diagnostics and change the hypothesis or method. Break difficult work into smaller verifiable steps. Continue despite complexity, slow verifications, or context compaction. Do not lower the target, weaken verifications, fabricate evidence, or substitute unrelated improvements for the requested outcome.

Inspect a failure before rerunning it. Repeat failed operations only when evidence suggests a transient condition or a relevant input has changed, and only where repository policy permits. Avoid duplicate external writes and unchanged retry loops. Await legitimate in-flight work using the runtime's supported waits; obey rate limits and explicit budgets.

## Preserve continuity

Keep one compact checkpoint in an approved local scratch location, such as `.cache/autopilot/<goal-slug>/STATE.md` when the repository permits it; otherwise use a user cache outside the repository. Record its exact path in the goal or session context. Keep transient state out of commits and never store secrets there.

Update it after meaningful milestones, a changed approach, or before a context transition. Include:

- The original goal, completion criteria, constraints, and assumptions.
- Completed work and evidence, with exact commands and result or artifact paths.
- Remaining work, the next concrete action, and any running job identifiers.
- Failed approaches, blockers, recovery conditions, and authorized external actions already performed.

After continuation or compaction, read the checkpoint, reconcile it with current files and job state, and resume the next action. A context transition does not reset the goal or justify repeating completed work. Incorporate user steering; pause or stop when explicitly requested.

## Handle blockers without babysitting

For missing preferences, use a reversible default. For missing facts, investigate available sources. For tool or service failures, use a permitted alternative where it can produce the required evidence. Continue independent work while a dependency is unavailable.

Do not wait for a reply to an optional question. If an action requires approval that has not already been granted, defer that action, prepare everything needed to make it reviewable, record the exact approval requirement and its source, and continue other authorized work. Never bypass an approval denial or repository restriction. Do not infer authorization to publish, deploy, merge, spend money, contact others, create managed worktrees, or alter infrastructure merely from the request to work unattended.

Only treat the goal as blocked when all useful authorized paths are exhausted and progress actually requires an external change, access, sign-off, or indispensable user input. Capture the failing operation, evidence, alternatives attempted, and the smallest condition needed to resume. Follow native goal-tool rules before changing its status. Do not busy-loop, silently claim success, or leave an active goal churning on a permanent blocker.

## Complete with evidence

Verify each completion criterion against the final artifacts and the repository's required automated gates. Repair failures caused by the work and run the affected verifications again. A test that could not run is missing evidence, not a pass. Keep attestations truthful; leave unsupported claims unchecked and identify the missing proof.

Mark a persistent goal complete only when the requested outcome is achieved and no required work remains. Otherwise preserve the accurate incomplete status and checkpoint when a hard runtime limit forces interruption.

The final report states what was delivered, the completion evidence, and any remaining blocker or required human action. For an interrupted run, include the checkpoint path and next action. Do not say the goal is complete because time or budget ran out.

A skill supplies workflow instructions, not an immortal process. Continued execution depends on the host staying available and its continuation support, credentials, permissions, and resource limits. Preserve resumable state when those limits interrupt the run.
