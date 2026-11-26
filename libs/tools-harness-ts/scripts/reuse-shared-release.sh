#!/usr/bin/env bash
# A successful exit lets this main push reuse both shared reconciliation jobs.
# Any uncertainty (including GitHub unavailability) requests a fresh apply.
set -euo pipefail
[[ "$GITHUB_EVENT_NAME" == push && "$GITHUB_REF" == refs/heads/main && "$GITHUB_RUN_ATTEMPT" == 1 ]]

api="repos/$GITHUB_REPOSITORY/actions"
# Apply results are reusable for an hour. Include the preceding ten minutes
# because an earlier run could have applied during that hour before its deadline.
fresh=$(date -u -d '1 hour ago' +%FT%TZ)
since=$(date -u -d '70 minutes ago' +%FT%TZ)
runs=$(gh api -X GET "$api/workflows/deploy.yml/runs" -f branch=main -f "created=>=$since" -F per_page=100)
history=$(jq -er --argjson current "$GITHUB_RUN_ID" '
  select(.total_count == (.workflow_runs | length)) |
  [.workflow_runs[] | select(.id != $current and .display_title != "Release · rehearsal")] |
  sort_by(.updated_at) | reverse | .[:6][] |
  [.id,.head_sha,.status,.run_attempt,.created_at] | @tsv' <<< "$runs")
while read -r id sha status attempt created; do
  [[ "$status" == completed && "$attempt" == 1 && "$created" > "$fresh" ]]
  jobs=$(gh api "$api/runs/$id/attempts/1/jobs?per_page=100")
  results=$(jq -er '
    select(.total_count == (.jobs | length)) |
    [.jobs[] | select(.name == "Enforce repository policy" or .name == "Release shared services")] |
    select((map(.name) | unique | length) == 2 and length == 2) |
    map(.conclusion) | join(" ")' <<< "$jobs")
  [[ "$results" != 'skipped skipped' ]] || continue
  [[ "$results" == 'success success' ]]
  git merge-base --is-ancestor "$sha" HEAD
  # Only paths disjoint from shared infrastructure, the auth relay, shared
  # credentials and its toolchain are allowed. Inspect both sides of renames.
  git diff --quiet --no-renames "$sha" HEAD -- . \
    ':(exclude)README.md' \
    ':(exclude).github/workflows/verify-nightly.yml' \
    ':(exclude)apps/product-ts/scripts/discover.ts' \
    ':(exclude)apps/product-ts/scripts/test-fuzz.ts' \
    ':(exclude)apps/product-ts/scripts/test-file-command.test.ts' \
    ':(exclude)apps/product-ts/turbo.json' \
    ':(exclude,glob)pkgs/*-client-ts/src/**/*.css' \
    ':(exclude,glob)pkgs/*-harness-ts/tests/storybook/**' \
    ':(exclude,glob)docs/**/*.md' ':(exclude,glob)specs/**/*.feature' \
    ':(exclude,glob)libs/*-client-ts/src/**' ':(exclude,glob)apps/product-client-ts/src/**' \
    ':(exclude).github/workflows/verify-pr.yml' \
    ':(exclude)libs/tools-harness-ts/scripts/ci-stage.ts' \
    ':(exclude)libs/tools-harness-ts/scripts/reuse-shared-release.sh' \
    ':(exclude)libs/tools-harness-ts/scripts/verify-plan.ts' \
    ':(exclude,glob)libs/tools-harness-ts/scripts/verify-plan-*.ts' \
    ':(exclude,glob)libs/tools-harness-ts/scripts/verify-shard-*.ts' \
    ':(exclude)libs/tools-harness-ts/scripts/verify-single-runner.ts' \
    ':(exclude,glob)libs/tools-harness-ts/scripts/*.test.ts' \
    ':(exclude,glob)libs/tools-harness-ts/goal/known-bugs/*.json'
  echo "Reusing shared services and repository policy from Release $id at $sha."
  exit 0
done <<< "$history"
exit 1
