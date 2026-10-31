---
description: Build, review or maintain UI through the canonical Storybook agent workflow, using production contracts and automated evidence
---

# /storybook-ui

Read [`pkgs/ui-root-harness-ts/README.md`](../../pkgs/ui-root-harness-ts/README.md)
in full, then apply its **Agent workflow** to the task supplied after this
command. Resolve all paths and commands from the repository root.

For a build or maintenance task, carry out the requested change and its
verification. For a review-only task, inspect the relevant stories, production
contracts and available automated evidence; report findings without changing
production code. If no task was supplied, discover the relevant existing work
from session context; ask for the target only when none can be inferred.

Follow the linked workflow's discovery, reuse, story authoring, full Essentials review, review evidence
and maintenance guidance. Keep it as the source of truth rather than copying it
into this command or another harness's instructions. Report actual results and
precise blockers; a preview is design context, never verification evidence.
