"""Dispatch a sized hosted batch or summarize its GitHub jobs and metrics."""

import argparse
import datetime
import json
import math
from pathlib import Path
import re
import subprocess


def output(*args):
    return subprocess.check_output(args, text=True).strip()


def dispatch(size, ref, base, skip):
    if not 1 <= size <= 256 or skip < 0:
        raise ValueError("Expected 1–256 matrix jobs and a nonnegative history offset")
    commit = output(
        "git", "rev-parse", "--verify", "--end-of-options", base + "^{commit}"
    )
    subprocess.run(
        ["git", "merge-base", "--is-ancestor", commit, "origin/main"], check=True
    )
    revisions = output(
        "git",
        "rev-list",
        "--first-parent",
        f"--skip={skip}",
        f"--max-count={size}",
        commit,
    ).splitlines()
    if len(set(revisions)) != size:
        raise ValueError(f"Requested {size} distinct revisions; found {len(revisions)}")
    inputs = {"group": "pr-load", "pr-load-revisions": json.dumps(revisions)}
    subprocess.run(
        ["gh", "workflow", "run", "verify-nightly.yml", "--ref", ref, "--json"],
        input=json.dumps(inputs),
        text=True,
        check=True,
    )


def timestamp(value):
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def distribution(values):
    values = sorted(values)
    if not values:
        return {"samples": 0, "p95": None}
    return {"samples": len(values), "p95": values[math.ceil(0.95 * len(values)) - 1]}


def summarize(run, jobs, metrics):
    passed = [j for j in jobs if j["conclusion"] == "success"]
    creation = timestamp(run["created_at"])
    elapsed = max(timestamp(j["completed_at"]) for j in jobs) - creation
    matched = {}
    for job in jobs:
        revision = re.fullmatch(
            r"verify-nightly:pr-load \(([0-9a-f]{40})\)", job["name"]
        )[1]
        if revision in matched:
            raise ValueError(f"Duplicate worker for {revision}")
        matched[revision] = job
    if metrics.keys() - matched.keys():
        raise ValueError("Measurements include revisions outside this run")
    good = [
        m
        for r, m in metrics.items()
        if matched[r]["conclusion"] == "success" and m["exitCode"] == 0
    ]
    task_count = sum(m.get("tasks", 0) for m in good)
    return {
        "run": run["html_url"],
        "attempt": run["run_attempt"],
        "jobs": len(jobs),
        "passed": len(passed),
        "failedOrCancelled": len(jobs) - len(passed),
        "missingMeasurements": sorted(matched.keys() - metrics.keys()),
        "elapsedSeconds": elapsed,
        "verifiedPerMinute": 60 * len(passed) / elapsed,
        "queueSeconds": distribution(
            timestamp(j["started_at"]) - timestamp(j["created_at"])
            for j in jobs
            if j.get("runner_id")
        ),
        "runnerSetupSeconds": distribution(
            timestamp(s["completed_at"]) - timestamp(s["started_at"])
            for j in jobs
            for s in j["steps"]
            if s["name"] == "Set up job" and s["conclusion"] == "success"
        ),
        "checkoutAndSetupSeconds": distribution(
            timestamp(s["started_at"]) - timestamp(j["started_at"])
            for j in jobs
            for s in j["steps"]
            if s["name"] == "Execute PR checks"
            and s["conclusion"] in ("success", "failure")
        ),
        "successfulValidationSeconds": distribution(
            timestamp(j["completed_at"]) - creation for j in passed
        ),
        "planSeconds": distribution(
            m["phases"]["plan"] for m in good if "plan" in m["phases"]
        ),
        "executionSeconds": distribution(
            m["phases"]["turbo"] for m in good if "turbo" in m["phases"]
        ),
        "cacheHitFraction": sum(m.get("hits", 0) for m in good) / task_count
        if task_count
        else None,
        "cpuFraction": distribution(
            m["cpuFraction"] for m in good if "cpuFraction" in m
        ),
        "peakHostMemoryFraction": distribution(
            m["peakHostMemoryFraction"] for m in good if "peakHostMemoryFraction" in m
        ),
        "maxProcessRssKiB": distribution(m["maxProcessRssKiB"] for m in good),
        "workerMinutesPerPass": sum(
            timestamp(j["completed_at"]) - timestamp(j["started_at"])
            for j in jobs
            if j.get("runner_id")
        )
        / (60 * len(passed))
        if passed
        else None,
    }


def report(run_id, expected):
    if run_id < 1 or expected < 1:
        raise ValueError("Run ID and expected job count must be positive")
    api = f"repos/{{owner}}/{{repo}}/actions/runs/{run_id}"
    run = json.loads(output("gh", "api", api))
    if run["status"] != "completed":
        raise ValueError(f"Run {run_id} is still {run['status']}")
    attempt = run["run_attempt"]
    pages = json.loads(
        output(
            "gh",
            "api",
            "--paginate",
            "--slurp",
            f"{api}/attempts/{attempt}/jobs?per_page=100",
        )
    )
    jobs = [
        j
        for page in pages
        for j in page["jobs"]
        if j["name"].startswith("verify-nightly:pr-load (")
    ]
    if len(jobs) != expected:
        raise ValueError(
            f"Expected {expected} workload jobs; GitHub reported {len(jobs)}"
        )
    root = Path(".cache/pr-load-reports") / str(run_id) / str(attempt)
    root.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "gh",
            "run",
            "download",
            str(run_id),
            "--pattern",
            "pr-load-*",
            "--dir",
            str(root),
        ],
        check=True,
    )
    metrics = {}
    for path in root.glob("pr-load-*/metrics.json"):
        data = json.loads(path.read_text())
        if path.parent.name != "pr-load-" + data["revision"]:
            raise ValueError(f"Artifact revision mismatch in {path}")
        metrics[data["revision"]] = data
    result = summarize(run, jobs, metrics)
    print(json.dumps(result, indent=2))
    (root / "summary.json").write_text(json.dumps(result, indent=2) + "\n")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    commands = cli.add_subparsers(dest="command", required=True)
    launch = commands.add_parser("dispatch")
    launch.add_argument("size", type=int)
    launch.add_argument("--ref", default="main")
    launch.add_argument("--base", default="origin/main")
    launch.add_argument("--skip", type=int, default=0)
    read = commands.add_parser("report")
    read.add_argument("run_id", type=int)
    read.add_argument("expected", type=int)
    args = cli.parse_args()
    if args.command == "dispatch":
        dispatch(args.size, args.ref, args.base, args.skip)
    else:
        report(args.run_id, args.expected)
