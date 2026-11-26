"""Check hosted stage durations, including admission and runner queues."""
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

# Seconds from workflow creation to its verdict, including any reruns.
BUDGETS = {
    "Verify PR": ("verify-pr.yml", 120, 180),
    "Release": ("deploy.yml", 480, 600),
    "Verify Nightly": ("verify-nightly.yml", 1800, 2700),
}


def eligible(stage, run):
    if stage == "Verify PR":
        return run["event"] == "pull_request"
    if stage == "Release":
        return run["head_branch"] == "main" and run["display_title"] in (
            "Release · push", "Release · manual"
        )
    return run["display_title"] in (
        "Verify Nightly · schedule", "Verify Nightly · manual"
    )


def report(stage, runs, now):
    _, target, ceiling = BUDGETS[stage]
    missed = []
    over_target = passed = cancelled = 0
    for run in runs:
        if not eligible(stage, run):
            continue
        if run["conclusion"] == "cancelled":
            cancelled += 1
        start = datetime.fromisoformat(run["created_at"])
        end = datetime.fromisoformat(run["updated_at"]) if run["status"] == "completed" else now
        seconds = (end - start).total_seconds()
        if seconds < 0:
            raise ValueError(f"Invalid run timestamps for {run['html_url']}")
        if seconds > ceiling:
            missed.append(f"{run['html_url']} ({seconds:.0f}s, {run['conclusion'] or run['status']})")
        if seconds >= target:
            over_target += 1
        if run["conclusion"] == "success":
            passed += 1
    print(f"{stage}: {passed} successful, {cancelled} cancelled, {over_target} at or above "
          f"{target}s target, {len(missed)} over {ceiling}s ceiling")
    for line in missed:
        print(line)
    return len(missed)


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    until = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    missed = 0
    for stage, (workflow, _, _) in BUDGETS.items():
        url = f"repos/{repo}/actions/workflows/{workflow}/runs?per_page=100&created={since}..{until}"
        pages = json.loads(subprocess.check_output(["gh", "api", "--paginate", "--slurp", url]))
        runs = [run for page in pages for run in page["workflow_runs"]]
        if len({run["id"] for run in runs}) < pages[0]["total_count"]:
            raise ValueError(f"Incomplete run history for {stage}")
        missed += report(stage, runs, now)
    return 1 if missed else 0


if __name__ == "__main__":
    sys.exit(main())
