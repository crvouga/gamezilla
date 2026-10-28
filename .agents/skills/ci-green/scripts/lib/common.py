"""Shared helpers for the ci-green scripts: repo paths, git, globbing,
check classification and the JSON state under `.ci-green/`."""

import fnmatch
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time

STATE_DIR_NAME = ".ci-green"

PHASES = [
    "format",
    "lint",
    "security",
    "typecheck",
    "build",
    "unit",
    "other",
    "integration",
    "end-to-end",
]

WEIGHTS = ["light", "medium", "heavy"]


# -- process helpers -------------------------------------------------------
def run(cmd, cwd=None, timeout=30, env=None):
    """Run a command; return (exit_code, stdout, stderr). Never raises."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            universal_newlines=True,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except (OSError, subprocess.SubprocessError) as exc:
        return 127, "", str(exc)


def git(args, cwd=None, timeout=30):
    code, out, _ = run(["git"] + list(args), cwd=cwd, timeout=timeout)
    return out.strip() if code == 0 else None


def die(message, code=2):
    sys.stderr.write("ci-green: %s\n" % message)
    sys.exit(code)


def warn(message):
    sys.stderr.write("ci-green: warning: %s\n" % message)


# -- repository layout -----------------------------------------------------
def repo_root(start=None):
    root = git(["rev-parse", "--show-toplevel"], cwd=start or os.getcwd())
    if not root:
        die("not inside a git repository (run from the repo you want green)")
    return os.path.realpath(root)


def primary_root(root):
    """The main worktree's root, so every worktree shares one budget."""
    common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=root)
    if not common:
        common = git(["rev-parse", "--git-common-dir"], cwd=root)
        if common and not os.path.isabs(common):
            common = os.path.join(root, common)
    if common and os.path.basename(os.path.normpath(common)) == ".git":
        return os.path.realpath(os.path.dirname(os.path.normpath(common)))
    return root


def ensure_state_dir(base):
    path = os.path.join(base, STATE_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    ignore = os.path.join(path, ".gitignore")
    if not os.path.exists(ignore):
        with open(ignore, "w") as handle:
            handle.write("# ci-green local state; never commit it.\n*\n")
    return path


def state_dir(root=None):
    override = os.environ.get("CI_GREEN_STATE_DIR")
    if override:
        os.makedirs(override, exist_ok=True)
        return override
    return ensure_state_dir(root or repo_root())


def budget_dir(root=None):
    """Shared by every worktree of the repo (override: CI_GREEN_BUDGET_DIR)."""
    override = os.environ.get("CI_GREEN_BUDGET_DIR")
    if override:
        os.makedirs(override, exist_ok=True)
        return override
    base = ensure_state_dir(primary_root(root or repo_root()))
    path = os.path.join(base, "budget")
    os.makedirs(path, exist_ok=True)
    return path


def read_json(path, default=None):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return default


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = "%s.tmp.%d" % (path, os.getpid())
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, sort_keys=False)
        handle.write("\n")
    os.replace(tmp, path)


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def read_text(path, limit=2_000_000):
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            return handle.read(limit)
    except OSError:
        return None


# -- check records ---------------------------------------------------------
def new_check(system, check_id, name, source, file):
    """The shape every CI translator fills in (see references/check-discovery.md)."""
    return {
        "id": check_id,
        "name": name,
        "system": system,
        "source": source,
        "file": file,
        "workflow": None,
        "job": None,
        "in_pr": True,
        "trigger": "",
        "path_filters": None,
        "matrix": None,
        "needs": [],
        "runs_on": None,
        "os": "unknown",
        "container": None,
        "services": [],
        "toolchain": {},
        "env": {},
        "cwd": ".",
        "timeout_minutes": None,
        "steps": [],
        "secrets": [],
        "vars": [],
        "unresolved": [],
        "notes": [],
        "local": {"reasons": []},
    }


def step(name, run=None, cwd=".", env=None, shell="bash", local="run", note=None, **extra):
    entry = {"name": name, "local": local, "run": run, "cwd": cwd or ".", "shell": shell, "env": env or {}}
    if note:
        entry["note"] = note
    entry.update(extra)
    if run and local == "run":
        effect = side_effect_reason(run)
        mutation = system_mutation_reason(run)
        if effect:
            entry.update(local="ci-only", note=effect)
        elif mutation:
            entry.update(local="skip", kind="system-setup", note="%s; make sure what it installs exists locally" % mutation)
        elif is_setup_command(run):
            entry["kind"] = "setup"
    return entry


# -- naming ----------------------------------------------------------------
def slug(*parts):
    text = "-".join(str(p) for p in parts if p not in (None, ""))
    text = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return text or "check"


# -- globbing (GitHub / GitLab path filters) -------------------------------
def glob_to_regex(pattern):
    """`*` stays in one path segment, `**` crosses segments, `?` one char."""
    out = ""
    i = 0
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**/", i):
            out += "(?:.*/)?"
            i += 3
            continue
        if pattern.startswith("**", i):
            out += ".*"
            i += 2
            continue
        if c == "*":
            out += "[^/]*"
        elif c == "?":
            out += "[^/]"
        elif c == "[":
            j = pattern.find("]", i)
            if j == -1:
                out += re.escape(c)
            else:
                out += pattern[i:j + 1]
                i = j + 1
                continue
        else:
            out += re.escape(c)
        i += 1
    return re.compile("^" + out + "$")


def path_matches(path, pattern):
    pattern = pattern.lstrip("/")
    if pattern.startswith("./"):
        pattern = pattern[2:]
    if glob_to_regex(pattern).match(path):
        return True
    # A bare directory or a pattern without a slash also matches below it.
    if not any(ch in pattern for ch in "*?[") and path.startswith(pattern.rstrip("/") + "/"):
        return True
    return fnmatch.fnmatch(path, pattern)


def filter_paths(changed, include, exclude):
    """GitHub semantics: patterns are ordered; a leading `!` negates."""
    if not changed:
        return []
    hits = []
    for path in changed:
        if include:
            keep = False
            for pattern in include:
                pattern = str(pattern)
                if pattern.startswith("!"):
                    if path_matches(path, pattern[1:]):
                        keep = False
                elif path_matches(path, pattern):
                    keep = True
        else:
            keep = True
        if keep and exclude:
            for pattern in exclude:
                if path_matches(path, str(pattern)):
                    keep = False
        if keep:
            hits.append(path)
    return hits


# -- classification --------------------------------------------------------
_PHASE_RULES = [
    ("end-to-end", r"\be2e\b|end[-_ ]?to[-_ ]?end|playwright|cypress|selenium|detox|maestro|webdriver|puppeteer|\bjourney"),
    ("integration", r"integration|\bit[-_:]|contract[-_ ]test|testcontainers|docker[- ]compose .*(up|run)|acceptance"),
    ("format", r"\bfmt\b|format|prettier|black\b|isort|gofmt|goimports|rustfmt|cargo fmt|clang-format|shfmt|ktlint -F|dprint|stylua|swiftformat"),
    ("security", r"gitleaks|trufflehog|trivy|codeql|semgrep|snyk|npm audit|pnpm audit|yarn audit|bun audit|cargo audit|cargo deny|pip-audit|safety check|bandit|osv-scanner|govulncheck|audit\b|secret"),
    ("typecheck", r"typecheck|type-check|types?:check|\btsc\b|mypy|pyright|basedpyright|pytype|cargo check|\bgo vet\b|\btc\b|flow check|vue-tsc|svelte-check|sorbet|phpstan|psalm"),
    ("lint", r"lint|eslint|oxlint|biome|ruff|flake8|pylint|clippy|golangci|staticcheck|rubocop|shellcheck|hadolint|actionlint|markdownlint|stylelint|yamllint|tflint|swiftlint|ktlint|detekt|checkstyle|spotbugs|pmd|credo|knip|depcheck|syncpack|commitlint|naming|pre-commit"),
    ("build", r"\bbuild\b|compile|bundle|package\b|assemble|webpack|vite build|rollup|esbuild|tsup|cargo build|go build|docker build|xcodebuild|gradle.*assemble|mvn .*package"),
    ("unit", r"\btest|pytest|jest|vitest|mocha|jasmine|\bava\b|tap\b|go test|cargo test|cargo nextest|rspec|phpunit|minitest|ctest|bun test|deno test|swift test|mvn .*(test|verify)|gradle.*test|tox|nox|spec\b|\bcheck\b|verify"),
]

_WEIGHT_BY_PHASE = {
    "format": "light",
    "lint": "medium",
    "security": "light",
    "typecheck": "medium",
    "build": "medium",
    "unit": "medium",
    "other": "medium",
    "integration": "heavy",
    "end-to-end": "heavy",
}


def classify_phase(name, commands):
    """Pick the phase from the check name first, then from its commands."""
    if re.search(r"deploy|release|publish|rollout|health", (name or "").lower()):
        return "other"
    for text in [name or ""] + list(commands or []):
        low = text.lower()
        for phase, pattern in _PHASE_RULES:
            if re.search(pattern, low):
                return phase
    return "other"


def estimate_weight(phase, services, steps_count, timeout_minutes=None):
    weight = _WEIGHT_BY_PHASE.get(phase, "medium")
    if services:
        weight = "heavy"
    # A job CI allows twenty minutes or more is a large suite.
    if isinstance(timeout_minutes, (int, float)) and timeout_minutes >= 20:
        weight = "heavy"
    if weight == "light" and steps_count > 4:
        weight = "medium"
    return weight


def observed_weight(cpu_avg, max_rss_mb):
    if cpu_avg >= 3.0 or max_rss_mb >= 3072:
        return "heavy"
    if cpu_avg >= 1.5 or max_rss_mb >= 1024:
        return "medium"
    return "light"


# -- commands that must never run on a developer machine -------------------
_SIDE_EFFECT_RULES = [
    (r"\bgit\s+push\b", "pushes to a remote"),
    (r"\b(npm|pnpm|yarn|bun)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b|\bgem\s+push\b|\bpoetry\s+publish\b", "publishes a package"),
    (r"\bdocker\s+(push|login)\b|\bdocker\s+buildx\s+.*--push\b", "pushes an image"),
    (r"\bgh\s+(api|release|pr|issue|workflow|run|secret|variable|cache|label)\b", "calls the GitHub API"),
    (r"\bcurl\b[^\n|;]*(-X\s*(POST|PUT|PATCH|DELETE)|--request\s+(POST|PUT|PATCH|DELETE)|--data|-d\s|--upload-file|-T\s)", "sends data to a remote service"),
    (r"\b(aws|gcloud|gsutil|az|doctl|flyctl|heroku|vercel|netlify|wrangler\s+(deploy|publish)|railway\s+up|firebase\s+deploy)\b", "uses cloud credentials"),
    (r"\b(kubectl|helm)\s+(apply|install|upgrade|delete|rollout)\b", "changes a cluster"),
    (r"\b(terraform|tofu)\s+(apply|destroy|import)\b|\bpulumi\s+(up|destroy)\b", "changes infrastructure"),
    (r"\bcodecov\b|coveralls|sonar-scanner|\bsentry-cli\b", "uploads to a hosted service"),
    (r"\bdeploy\b", "deploys"),
]

_CI_RUNTIME_RULES = [
    (r"ACTIONS_ID_TOKEN_REQUEST_(URL|TOKEN)|ACTIONS_RUNTIME_TOKEN|ACTIONS_RESULTS_URL|ACTIONS_CACHE_URL", "needs the CI runner's OIDC/runtime token"),
    (r"CI_JOB_JWT|CI_JOB_TOKEN|SYSTEM_ACCESSTOKEN|BUILDKITE_AGENT_ACCESS_TOKEN|CIRCLE_OIDC_TOKEN", "needs the CI runner's job token"),
    (r"buildkite-agent\s+(artifact|meta-data|annotate|pipeline)", "talks to the Buildkite agent"),
]

_SYSTEM_MUTATION_RULES = [
    (r"\bsudo\b", "uses sudo"),
    (r"\b(apt|apt-get|yum|dnf|apk|zypper|pacman)\s+(install|add|update|upgrade)\b", "installs system packages"),
    (r"\bbrew\s+(install|upgrade|tap)\b|\bchoco\s+install\b|\bwinget\s+install\b|\bsnap\s+install\b", "installs system packages"),
    (r"\b(npm|pnpm|yarn)\s+(install|add|i)\s+(-g|--global)\b|\bnpm\s+i\s+-g\b|\bgem\s+install\b|\bcargo\s+install\b|\bgo\s+install\b|\bpipx\s+install\b|\bpip3?\s+install\s+--user\b", "installs a global tool"),
    (r"\bsystemctl\b|\bservice\s+\S+\s+(start|stop|restart)\b|\blaunchctl\b", "manages system services"),
    (r"\bupdate-alternatives\b|\bsysctl\s+-w\b|\bulimit\s+-[a-z]*\s+unlimited\b", "changes system settings"),
]

_SETUP_RULES = r"^\s*(npm\s+(ci|install|i)\b|pnpm\s+(install|i)\b|yarn(\s+install)?\s*($|--)|bun\s+install\b|pip3?\s+install\b|python3?\s+-m\s+pip\s+install\b|poetry\s+install\b|uv\s+(sync|pip\s+install)\b|pipenv\s+install\b|bundle\s+install\b|composer\s+install\b|go\s+mod\s+(download|tidy)\b|cargo\s+fetch\b|mise\s+install\b|asdf\s+install\b|corepack\s+enable\b|dotnet\s+restore\b|mvn\s+.*dependency:|gradle\s+.*dependencies\b|swift\s+package\s+resolve\b|pod\s+install\b|git\s+(fetch|config|submodule)\b|echo\b.*>>\s*\"?\$\{?GITHUB_(ENV|PATH|OUTPUT|STEP_SUMMARY)\b)"


def side_effect_reason(command):
    for pattern, reason in _CI_RUNTIME_RULES + _SIDE_EFFECT_RULES:
        if re.search(pattern, command, re.IGNORECASE):
            return reason
    return None


def system_mutation_reason(command):
    for pattern, reason in _SYSTEM_MUTATION_RULES:
        if re.search(pattern, command):
            return reason
    return None


def is_setup_command(command):
    lines = [l for l in command.strip().splitlines() if l.strip() and not l.strip().startswith("#")]
    return bool(lines) and all(re.search(_SETUP_RULES, l) for l in lines)


def which(name):
    return shutil.which(name)


def quote(cmd):
    return " ".join(shlex.quote(str(c)) for c in cmd)


# -- versions --------------------------------------------------------------
_VERSION = re.compile(r"(\d+)(?:\.(\d+))?(?:\.(\d+))?")


def parse_version(text):
    """First dotted version in text -> tuple of ints, or None."""
    if text is None:
        return None
    m = _VERSION.search(str(text))
    if not m:
        return None
    return tuple(int(g) for g in m.groups() if g is not None)


# Toolchains whose minor version is the language version (3.11 vs 3.12).
_MINOR_IS_MAJOR = {"python", "go", "ruby", "swift"}


def version_matches(pinned, actual, tool=None):
    """(ok, severity). A different major — or a different minor where the
    minor is the language version — is a mismatch; anything finer warns."""
    want = parse_version(pinned)
    have = parse_version(actual)
    if want is None or have is None:
        return True, "unknown"
    if want[0] != have[0]:
        return False, "major"
    if len(want) >= 2 and len(have) >= 2 and want[1] != have[1]:
        return (False, "major") if tool in _MINOR_IS_MAJOR else (True, "minor")
    if len(want) >= 3 and len(have) >= 3 and want[2] != have[2]:
        return True, "patch"
    return True, "exact"
