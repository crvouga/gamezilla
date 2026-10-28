"""GitHub Actions: workflows, reusable workflows, composite actions and
matrices, translated into local checks as a pull request would run them."""

import itertools
import os
import re

import common
import expressions as ex
import yaml_lite

SYSTEM = "github-actions"
PR_EVENTS = ("pull_request", "pull_request_target", "merge_group")

# uses: <action> -> toolchain name and the inputs that carry its version.
SETUP_ACTIONS = {
    "actions/setup-node": ("node", ["node-version"], ["node-version-file"]),
    "actions/setup-python": ("python", ["python-version"], ["python-version-file"]),
    "actions/setup-go": ("go", ["go-version"], ["go-version-file"]),
    "actions/setup-java": ("java", ["java-version"], ["java-version-file"]),
    "actions/setup-dotnet": ("dotnet", ["dotnet-version"], ["global-json-file"]),
    "ruby/setup-ruby": ("ruby", ["ruby-version"], []),
    "oven-sh/setup-bun": ("bun", ["bun-version"], ["bun-version-file"]),
    "pnpm/action-setup": ("pnpm", ["version"], []),
    "denoland/setup-deno": ("deno", ["deno-version"], []),
    "astral-sh/setup-uv": ("uv", ["version"], []),
    "hashicorp/setup-terraform": ("terraform", ["terraform_version"], []),
    "opentofu/setup-opentofu": ("opentofu", ["tofu_version"], []),
    "dtolnay/rust-toolchain": ("rust", ["toolchain"], []),
    "actions-rs/toolchain": ("rust", ["toolchain"], []),
    "erlef/setup-beam": ("elixir", ["elixir-version"], []),
    "shivammathur/setup-php": ("php", ["php-version"], []),
    "swift-actions/setup-swift": ("swift", ["swift-version"], []),
    "gradle/actions/setup-gradle": ("gradle", ["gradle-version"], []),
    "subosito/flutter-action": ("flutter", ["flutter-version"], []),
}

MANAGER_ACTIONS = {
    "jdx/mise-action": "mise",
    "asdf-vm/actions/setup": "asdf",
    "asdf-vm/actions/install": "asdf",
    "jetify-com/devbox-install-action": "devbox",
    "cachix/install-nix-action": "nix",
    "DeterminateSystems/nix-installer-action": "nix",
}

SKIP_ACTIONS = {
    "actions/checkout": "checkout (the working tree is already here)",
    "actions/cache": "cache",
    "actions/cache/restore": "cache",
    "actions/cache/save": "cache",
    "actions/upload-artifact": "artifact upload",
    "actions/download-artifact": "artifact download from another job",
    "actions/labeler": "PR labels",
    "actions/stale": "issue housekeeping",
    "actions/configure-pages": "Pages",
    "actions/upload-pages-artifact": "Pages",
    "actions/attest-build-provenance": "provenance attestation",
    "docker/setup-buildx-action": "buildx setup",
    "docker/setup-qemu-action": "qemu setup",
    "docker/metadata-action": "image metadata",
    "Swatinem/rust-cache": "cache",
    "styfle/cancel-workflow-action": "run housekeeping",
}

CI_ONLY_ACTIONS = {
    "github/codeql-action": "CodeQL analysis runs on GitHub's infrastructure",
    "actions/github-script": "scripts against the GitHub API",
    "actions/dependency-review-action": "needs the GitHub dependency graph",
    "aws-actions/configure-aws-credentials": "needs cloud credentials (OIDC)",
    "google-github-actions/auth": "needs cloud credentials (OIDC)",
    "azure/login": "needs cloud credentials (OIDC)",
    "codecov/codecov-action": "uploads coverage to a hosted service",
    "coverallsapp/github-action": "uploads coverage to a hosted service",
    "SonarSource/sonarcloud-github-action": "hosted analysis",
    "super-linter/super-linter": "a containerised bundle of linters; run the linters it enables instead",
    "github/super-linter": "a containerised bundle of linters; run the linters it enables instead",
    "reviewdog/action-setup": "posts review comments",
    "peter-evans/create-pull-request": "opens a pull request",
    "softprops/action-gh-release": "publishes a release",
    "docker/login-action": "registry credentials",
    "Infisical/secrets-action": "injects CI secrets",
    "hashicorp/vault-action": "injects CI secrets",
    "1password/load-secrets-action": "injects CI secrets",
    "dopplerhq/secrets-fetch-action": "injects CI secrets",
    "bitwarden/sm-action": "injects CI secrets",
}

# Remote actions that wrap a CLI we can run directly.
def _translate(action, inputs):
    args = inputs.get("args") or ""
    if action == "golangci/golangci-lint-action":
        wd = inputs.get("working-directory")
        return "golangci-lint run %s" % args, wd, "golangci-lint"
    if action == "pre-commit/action":
        extra = inputs.get("extra_args") or "--all-files"
        return "pre-commit run --show-diff-on-failure --color=always %s" % extra, None, "pre-commit"
    if action == "rhysd/actionlint" or action == "raven-actions/actionlint":
        return "actionlint %s" % args, None, "actionlint"
    if action == "ludeeus/action-shellcheck":
        return "shellcheck $(git ls-files '*.sh')", inputs.get("scandir"), "shellcheck"
    if action == "chartboost/ruff-action" or action == "astral-sh/ruff-action":
        return "ruff %s" % (args or "check"), inputs.get("src"), "ruff"
    if action == "psf/black":
        return "black %s" % (inputs.get("options") or "--check --diff"), inputs.get("src"), "black"
    if action == "gitleaks/gitleaks-action":
        return "gitleaks git --redact --no-banner", None, "gitleaks"
    if action == "crate-ci/typos":
        return "typos", None, "typos"
    if action == "biomejs/setup-biome":
        return None, None, None
    if action == "docker/build-push-action":
        context = inputs.get("context") or "."
        dockerfile = inputs.get("file")
        cmd = "docker build %s%s" % ("-f %s " % dockerfile if dockerfile else "", context)
        return cmd, None, "docker"
    return None, None, None


def _action_name(uses):
    name = uses.split("@", 1)[0]
    parts = name.split("/")
    return "/".join(parts[:3]) if len(parts) > 2 and parts[0] in ("gradle", "asdf-vm", "actions") else "/".join(parts[:2])


def _ref(uses):
    return uses.split("@", 1)[1] if "@" in uses else ""


def parse_on(raw):
    """Normalise `on:` into {event: config-dict}."""
    if raw is None:
        return {}
    if isinstance(raw, str):
        return {raw: {}}
    if isinstance(raw, list):
        return {str(e): {} for e in raw}
    if isinstance(raw, dict):
        return {str(k): (v if isinstance(v, dict) else {}) for k, v in raw.items()}
    return {}


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _branch_matches(branch, patterns):
    return any(common.path_matches(branch, str(p)) for p in patterns)


class Translator(object):
    def __init__(self, root, env_info):
        self.root = root
        self.info = env_info
        self.notes = []
        self.sources = []
        self.unparsed = []
        self.manager_hits = set()
        self.ci_version_files = {}

    # -- contexts ------------------------------------------------------
    def base_context(self):
        info = self.info
        github = {
            "event_name": "pull_request",
            "event": {
                "pull_request": {
                    "base": {"ref": info["base_branch"], "sha": info["merge_base"]},
                    "head": {"ref": info["branch"], "sha": info["head"]},
                    "number": ex.UNKNOWN,
                    "draft": False,
                    "labels": [],
                },
                "action": "synchronize",
            },
            "base_ref": info["base_branch"],
            "head_ref": info["branch"],
            "ref": "refs/pull/local/merge",
            "ref_name": info["branch"],
            "sha": info["head"],
            "repository": info.get("repo_slug") or ex.UNKNOWN,
            "repository_owner": (info.get("repo_slug") or "/").split("/")[0] or ex.UNKNOWN,
            "workspace": self.root,
            "server_url": "https://github.com",
            "actor": ex.UNKNOWN,
            "run_id": ex.UNKNOWN,
            "run_number": ex.UNKNOWN,
            "run_attempt": 1,
            "token": ex.UNKNOWN,
            "job": ex.UNKNOWN,
        }
        runner = {
            "os": {"darwin": "macOS", "linux": "Linux"}.get(info["host_os"], "Linux"),
            "arch": "ARM64" if info["host_arch"] in ("arm64", "aarch64") else "X64",
            "temp": "/tmp",
            "tool_cache": "/tmp",
        }
        return ex.Context(
            {
                "github": github,
                "runner": runner,
                "env": {},
                "inputs": {},
                "matrix": {},
                "strategy": {"job-index": 0, "job-total": 1, "fail-fast": True},
                "needs": ex.UNKNOWN,
                "steps": ex.UNKNOWN,
                "job": ex.UNKNOWN,
                "secrets": {},
                "vars": {},
            },
            self.root,
        )

    # -- entry ---------------------------------------------------------
    def discover(self):
        wf_dir = os.path.join(self.root, ".github", "workflows")
        if not os.path.isdir(wf_dir):
            return []
        checks = []
        for name in sorted(os.listdir(wf_dir)):
            if not name.endswith((".yml", ".yaml")):
                continue
            rel = ".github/workflows/" + name
            try:
                wf = yaml_lite.load(os.path.join(self.root, rel))
            except (yaml_lite.YamlError, OSError) as exc:
                self.unparsed.append({"file": rel, "reason": str(exc)})
                continue
            if not isinstance(wf, dict):
                continue
            self.sources.append(rel)
            checks.extend(self.workflow_checks(rel, wf))
        return checks

    def workflow_checks(self, rel, wf):
        on = parse_on(wf.get("on", wf.get("true")))
        events = sorted(on)
        pr_events = [e for e in events if e in PR_EVENTS]
        in_pr = bool(pr_events)
        trigger_note = "on: " + ", ".join(events) if events else "no triggers"
        if events == ["workflow_call"] or (set(events) <= {"workflow_call"} and events):
            return []  # reusable only: expanded where it is called
        path_include, path_exclude = [], []
        if in_pr:
            cfg = on.get("pull_request") or on.get("pull_request_target") or {}
            branches = _as_list(cfg.get("branches"))
            ignore = _as_list(cfg.get("branches-ignore"))
            base = self.info["base_branch"]
            if branches and not _branch_matches(base, branches):
                in_pr = False
                trigger_note += " (pull requests into %s only)" % ", ".join(map(str, branches))
            if ignore and _branch_matches(base, ignore):
                in_pr = False
                trigger_note += " (ignores pull requests into %s)" % base
            path_include = [str(p) for p in _as_list(cfg.get("paths"))]
            path_exclude = [str(p) for p in _as_list(cfg.get("paths-ignore"))]
        ctx = self.base_context()
        wf_env = self.env_block(wf.get("env"), ctx)
        ctx = ctx.child(env=dict(wf_env))
        if not in_pr:
            ctx = ctx.child(github=dict(ctx.values["github"], event_name=(events[0] if events else "push")))
        defaults = ((wf.get("defaults") or {}).get("run") or {}) if isinstance(wf.get("defaults"), dict) else {}
        workflow_name = str(wf.get("name") or os.path.basename(rel))
        base = {
            "system": SYSTEM,
            "file": rel,
            "workflow": workflow_name,
            "in_pr": in_pr,
            "trigger": trigger_note,
            "path_filters": {"include": path_include, "exclude": path_exclude} if (path_include or path_exclude) else None,
        }
        return self.jobs(rel, wf.get("jobs") or {}, ctx, wf_env, defaults, base, prefix="", id_prefix=slug_file(rel))

    def env_block(self, env, ctx):
        out = {}
        if not isinstance(env, dict):
            return out
        for key, value in env.items():
            local = ctx.child(env=dict(ctx.values.get("env") or {}, **out))
            out[str(key)] = ex.substitute(value, local)
        return out

    # -- jobs ----------------------------------------------------------
    def jobs(self, rel, jobs, ctx, wf_env, defaults, base, prefix, id_prefix, caller_needs=None):
        out = []
        id_of = {}
        for job_key, job in jobs.items():
            if not isinstance(job, dict):
                continue
            id_of[job_key] = "%s.%s" % (id_prefix, common.slug(job_key))
        for job_key, job in jobs.items():
            if not isinstance(job, dict):
                continue
            needs = [id_of.get(n, common.slug(n)) for n in map(str, _as_list(job.get("needs")))]
            if caller_needs and not needs:
                needs = list(caller_needs)
            out.extend(self.job(rel, job_key, job, ctx, wf_env, defaults, base, prefix, id_of[job_key], needs))
        return out

    def job(self, rel, job_key, job, ctx, wf_env, defaults, base, prefix, job_id, needs):
        display = str(job.get("name") or job_key)
        uses = job.get("uses")
        combos, matrix_note = self.matrix(job, ctx)
        out = []
        for idx, combo in enumerate(combos):
            mctx = ctx.child(
                matrix=combo or {},
                strategy={"job-index": idx, "job-total": len(combos), "fail-fast": True},
            )
            if matrix_note:
                mctx = mctx.child(strategy=ex.UNKNOWN)
            name = re.sub(r"\$\{\{.*?\}\}", "*", ex.to_str(ex.substitute(display, mctx)))
            if combo and "matrix." not in display:
                name += " (%s)" % ", ".join(ex.to_str(v) for v in combo.values())
            check_id = job_id + ("." + common.slug(*[ex.to_str(v) for v in combo.values()]) if combo else "")
            if isinstance(uses, str):
                out.extend(self.reusable(rel, job_key, job, mctx, base, prefix + name, check_id, needs))
                continue
            out.append(self.job_check(rel, job_key, job, mctx, wf_env, defaults, base, prefix + name, check_id, needs, combo, matrix_note))
        return out

    def matrix(self, job, ctx):
        strategy = job.get("strategy")
        if not isinstance(strategy, dict) or strategy.get("matrix") is None:
            return [None], None
        raw = ex.substitute(strategy.get("matrix"), ctx)
        if isinstance(raw, str):
            return [None], "matrix is computed at run time (%s)" % raw.strip()
        if not isinstance(raw, dict):
            return [None], "matrix could not be read"
        include = raw.get("include") or []
        exclude = raw.get("exclude") or []
        axes = {k: v for k, v in raw.items() if k not in ("include", "exclude")}
        dynamic = [k for k, v in axes.items() if not isinstance(v, list)]
        if dynamic or (isinstance(include, str)) or (isinstance(exclude, str)):
            return [None], "matrix axis %s is computed at run time" % ", ".join(dynamic or ["include/exclude"])
        combos = [dict(zip(axes, values)) for values in itertools.product(*axes.values())] if axes else []
        for ex_entry in exclude if isinstance(exclude, list) else []:
            if isinstance(ex_entry, dict):
                combos = [c for c in combos if not all(c.get(k) == v for k, v in ex_entry.items())]
        for inc in include if isinstance(include, list) else []:
            if not isinstance(inc, dict):
                continue
            matched = False
            for combo in combos:
                if all(combo.get(k) == v for k, v in inc.items() if k in axes):
                    combo.update({k: v for k, v in inc.items() if k not in axes})
                    matched = True
            if not matched:
                combos.append(dict(inc))
        if any(ex.has_template(v) for combo in combos for v in combo.values()):
            return [None], "matrix values are computed at run time"
        return (combos or [None]), None

    def reusable(self, rel, job_key, job, ctx, base, name, check_id, needs):
        uses = str(job["uses"])
        if not uses.startswith("./"):
            check = self.empty_check(base, rel, job_key, name, check_id, needs)
            check["local"] = {"runnable": "no", "reasons": ["calls the remote reusable workflow %s" % uses]}
            return [check]
        path = os.path.join(self.root, uses[2:].split("@")[0])
        try:
            callee = yaml_lite.load(path)
        except (yaml_lite.YamlError, OSError) as exc:
            check = self.empty_check(base, rel, job_key, name, check_id, needs)
            check["local"] = {"runnable": "no", "reasons": ["cannot read %s: %s" % (uses, exc)]}
            return [check]
        callee_rel = os.path.relpath(path, self.root)
        if callee_rel not in self.sources:
            self.sources.append(callee_rel)
        on = parse_on(callee.get("on", callee.get("true")))
        declared = (on.get("workflow_call") or {}).get("inputs") or {}
        given = ex.substitute(job.get("with") or {}, ctx)
        inputs = {}
        for key, spec in declared.items():
            default = spec.get("default") if isinstance(spec, dict) else None
            inputs[str(key)] = given.get(key, ex.substitute(default, ctx))
        for key, value in given.items():
            inputs.setdefault(str(key), value)
        cctx = ctx.child(inputs=inputs, env={})
        callee_env = self.env_block(callee.get("env"), cctx)
        cctx = cctx.child(env=dict(callee_env))
        defaults = ((callee.get("defaults") or {}).get("run") or {}) if isinstance(callee.get("defaults"), dict) else {}
        sub_base = dict(base)
        sub_base["called_workflow"] = callee_rel
        return self.jobs(
            callee_rel, callee.get("jobs") or {}, cctx, callee_env, defaults, sub_base,
            prefix=name + " / ", id_prefix=check_id, caller_needs=needs,
        )

    def empty_check(self, base, rel, job_key, name, check_id, needs):
        check = common.new_check(SYSTEM, check_id, name, "%s#jobs.%s" % (rel, job_key), rel)
        check.update(base)
        check.update(job=job_key, needs=needs)
        return check

    def job_check(self, rel, job_key, job, ctx, wf_env, defaults, base, name, check_id, needs, combo, matrix_note):
        ctx = ctx.isolated()
        check = self.empty_check(base, rel, job_key, name, check_id, needs)
        check["matrix"] = combo
        reasons = []
        if matrix_note:
            check["notes"].append(matrix_note)
            reasons.append(matrix_note)
        job_if = ex.condition(job.get("if"), ctx)
        if job.get("if") is not None:
            check["if"] = str(job.get("if"))
            if job_if is False:
                check["in_pr"] = False
                check["trigger"] += "; job condition is false for a pull request"
            elif job_if is ex.UNKNOWN:
                check["notes"].append("job runs only if: %s" % job.get("if"))
        runs_on = ex.substitute(job.get("runs-on"), ctx)
        check["runs_on"] = runs_on if not isinstance(runs_on, dict) else runs_on.get("labels") or runs_on.get("group")
        check["os"] = runner_os(check["runs_on"])
        host = self.info["host_os"]
        if check["os"] == "windows" and host != "windows":
            reasons.append("runs on Windows in CI")
        elif check["os"] == "macos" and host != "darwin":
            reasons.append("runs on macOS in CI")
        elif check["os"] == "linux" and host == "darwin":
            check["notes"].append("CI runs this on Linux; this machine is macOS (watch for case-sensitive paths, GNU vs BSD tools)")
        elif check["os"] == "unknown":
            check["notes"].append("runner %r: OS not recognised; assumed compatible" % (check["runs_on"],))
        job_env = self.env_block(job.get("env"), ctx)
        env = dict(wf_env)
        env.update(job_env)
        jctx = ctx.child(env=dict(env))
        check["env"] = env
        container = job.get("container")
        if container:
            image = container if isinstance(container, str) else (container or {}).get("image")
            check["container"] = ex.to_str(ex.substitute(image, jctx))
            check["notes"].append("CI runs every step inside the container %s" % check["container"])
            hint = image_toolchain(check["container"])
            if hint:
                check["toolchain"][hint[0]] = {"version": hint[1], "source": "container image %s" % check["container"]}
        check["services"] = self.services(job.get("services"), jctx)
        timeout = ex.substitute(job.get("timeout-minutes"), jctx)
        check["timeout_minutes"] = timeout if isinstance(timeout, (int, float)) else None
        job_defaults = dict(defaults)
        if isinstance(job.get("defaults"), dict):
            job_defaults.update((job["defaults"].get("run") or {}))
        steps = []
        for idx, step in enumerate(job.get("steps") or []):
            steps.extend(self.step(step, idx, jctx, job_defaults, check, depth=0))
        check["steps"] = steps
        if job.get("continue-on-error") is True:
            check["notes"].append("job has continue-on-error: its failure does not fail the workflow")
        check["secrets"] = sorted(jctx.secrets)
        check["vars"] = sorted(jctx.vars)
        check["unresolved"] = sorted(u for u in jctx.unresolved if not u.startswith("secrets."))
        check["local"] = {"reasons": reasons}
        return check

    def services(self, services, ctx):
        out = []
        if not isinstance(services, dict):
            return out
        for name, spec in services.items():
            if isinstance(spec, str):
                spec = {"image": spec}
            if not isinstance(spec, dict):
                continue
            spec = ex.substitute(spec, ctx)
            image = ex.to_str(spec.get("image"))
            if not image:
                continue
            ports = []
            for port in _as_list(spec.get("ports")):
                port = ex.to_str(port)
                ports.append(port if ":" in port else "%s:%s" % (port, port))
            env = {str(k): ex.to_str(v) for k, v in (spec.get("env") or {}).items()}
            out.append({"name": str(name), "image": image, "ports": ports, "env": env,
                        "options": ex.to_str(spec.get("options")) or None})
        return out

    # -- steps ---------------------------------------------------------
    def step(self, step, idx, ctx, defaults, check, depth, label_prefix=""):
        if not isinstance(step, dict):
            return []
        step_env = self.env_block(step.get("env"), ctx)
        sctx = ctx.child(env=dict(ctx.values["env"], **step_env))
        default = step.get("uses") or ("Run " + ex.to_str(step.get("run")).strip().splitlines()[0][:60] if step.get("run") else "step %d" % (idx + 1))
        label = label_prefix + ex.to_str(ex.substitute(step.get("name"), sctx) or default)
        if "\n" in label:
            label = label.strip().splitlines()[0]
        cond = ex.condition(step.get("if"), sctx)
        entry = {
            "name": label,
            "local": "run",
            "if": str(step["if"]) if step.get("if") is not None else None,
            "env": step_env,
            "continue_on_error": step.get("continue-on-error") is True,
        }
        if cond is False:
            entry.update(local="skip", note="condition is false for a pull request")
            return [entry]
        if cond is ex.UNKNOWN:
            entry["note"] = "runs in CI only if: %s" % step.get("if")
        if "run" in step:
            return [self.run_step(entry, step, sctx, defaults)]
        uses = step.get("uses")
        if not isinstance(uses, str):
            entry.update(local="skip", note="step has neither run nor uses")
            return [entry]
        entry["uses"] = uses
        inputs = {str(k): ex.substitute(v, sctx) for k, v in (step.get("with") or {}).items()}
        if uses.startswith("./") and depth < 5:
            inlined = self.composite(uses, inputs, sctx, defaults, check, depth, label)
            if inlined is not None:
                return inlined
            entry.update(local="ci-only", note="local action %s is not a composite action; no local command derived" % uses)
            return [entry]
        if uses.startswith("docker://"):
            entry.update(local="ci-only", note="runs the container %s" % uses[9:])
            return [entry]
        action = _action_name(uses)
        if action in SETUP_ACTIONS:
            tool, version_keys, file_keys = SETUP_ACTIONS[action]
            version = next((inputs[k] for k in version_keys if inputs.get(k) not in (None, "")), None)
            if version is None and action == "dtolnay/rust-toolchain":
                version = _ref(uses)
            source_file = next((inputs[k] for k in file_keys if inputs.get(k)), None)
            if version is not None:
                check["toolchain"][tool] = {"version": ex.to_str(version), "source": "%s in %s" % (action, check["file"])}
            elif source_file:
                self.ci_version_files[tool] = ex.to_str(source_file)
                check["toolchain"][tool] = {"version": None, "source": "%s reads %s" % (action, source_file), "file": ex.to_str(source_file)}
            entry.update(local="skip", kind="toolchain", note="toolchain: %s %s" % (tool, ex.to_str(version or source_file or "default")))
            return [entry]
        if action in MANAGER_ACTIONS:
            self.manager_hits.add(MANAGER_ACTIONS[action])
            check.setdefault("managers", [])
            if MANAGER_ACTIONS[action] not in check["managers"]:
                check["managers"].append(MANAGER_ACTIONS[action])
            entry.update(local="skip", kind="toolchain", note="toolchain manager %s installs the pinned tools" % MANAGER_ACTIONS[action])
            return [entry]
        if action in SKIP_ACTIONS:
            entry.update(local="skip", note=SKIP_ACTIONS[action])
            if action == "actions/download-artifact":
                check["notes"].append("downloads artifacts produced by another job; run that job first")
            return [entry]
        for prefix, reason in CI_ONLY_ACTIONS.items():
            if action == prefix or action.startswith(prefix + "/") or uses.startswith(prefix):
                entry.update(local="ci-only", note=reason)
                return [entry]
        if re.search(r"(^|[/-])setup-|install-", action.split("/")[-1]) or action.split("/")[-1].startswith("setup"):
            entry.update(local="skip", kind="system-setup",
                         note="%s installs a tool in CI; make sure it exists locally" % action)
            return [entry]
        command, cwd, tool = _translate(action, inputs)
        if command:
            entry.update(run=command.strip(), cwd=cwd or defaults.get("working-directory") or ".",
                         shell="bash", note="translated from %s" % uses, requires=[tool])
            return [entry]
        entry.update(local="ci-only", note="remote action %s: no local command derived; translate it by hand" % uses)
        return [entry]

    def run_step(self, entry, step, sctx, defaults):
        script = ex.to_str(ex.substitute(step.get("run"), sctx))
        shell = step.get("shell") or defaults.get("shell") or "bash"
        cwd = ex.to_str(ex.substitute(step.get("working-directory") or defaults.get("working-directory") or ".", sctx))
        entry.update(run=script, shell=ex.to_str(shell), cwd=cwd)
        if ex.has_template(script):
            entry["unresolved"] = sorted(set(re.findall(r"\$\{\{\s*(.*?)\s*\}\}", script)))
        effect = common.side_effect_reason(script)
        mutation = common.system_mutation_reason(script)
        if effect and entry.get("note", "").startswith("runs in CI only if"):
            entry.update(local="ci-only", note="%s (%s)" % (effect, entry["note"]))
        elif effect:
            entry.update(local="ci-only", note=effect)
        elif mutation:
            entry.update(local="skip", kind="system-setup", note="%s; make sure what it installs exists locally" % mutation)
        elif common.is_setup_command(script):
            entry["kind"] = "setup"
        return entry

    def composite(self, uses, inputs, ctx, defaults, check, depth, label):
        base = os.path.join(self.root, uses[2:].split("@")[0])
        for name in ("action.yml", "action.yaml"):
            path = os.path.join(base, name)
            if os.path.exists(path):
                break
        else:
            return None
        try:
            action = yaml_lite.load(path)
        except (yaml_lite.YamlError, OSError):
            return None
        rel = os.path.relpath(path, self.root)
        if rel not in self.sources:
            self.sources.append(rel)
        runs = (action or {}).get("runs") or {}
        if runs.get("using") != "composite":
            return None
        declared = action.get("inputs") or {}
        values = {}
        for key, spec in declared.items():
            default = spec.get("default") if isinstance(spec, dict) else None
            values[str(key)] = inputs.get(key, ex.substitute(default, ctx))
        for key, value in inputs.items():
            values.setdefault(key, value)
        actx = ctx.child(inputs=values)
        out = []
        for idx, inner in enumerate(runs.get("steps") or []):
            out.extend(self.step(inner, idx, actx, {}, check, depth + 1, label_prefix=label + " › "))
        return out


def slug_file(rel):
    stem = os.path.splitext(os.path.basename(rel))[0]
    return "gha." + common.slug(stem)


def runner_os(runs_on):
    labels = " ".join(ex.to_str(x) for x in _as_list(runs_on)).lower()
    if not labels:
        return "unknown"
    if "windows" in labels:
        return "windows"
    if "macos" in labels or "mac-" in labels or "xcode" in labels:
        return "macos"
    if "ubuntu" in labels or "linux" in labels:
        return "linux"
    return "unknown"


_IMAGE_TOOLS = [
    (r"(^|/)node:v?(\d+(\.\d+)*)", "node"),
    (r"(^|/)(python|pypy):(\d+(\.\d+)*)", "python"),
    (r"(^|/)golang:(\d+(\.\d+)*)", "go"),
    (r"(^|/)rust:(\d+(\.\d+)*)", "rust"),
    (r"(^|/)ruby:(\d+(\.\d+)*)", "ruby"),
    (r"(^|/)(eclipse-temurin|openjdk|amazoncorretto):(\d+(\.\d+)*)", "java"),
    (r"(^|/)oven/bun:(\d+(\.\d+)*)", "bun"),
    (r"(^|/)cimg/node:(\d+(\.\d+)*)", "node"),
    (r"(^|/)cimg/python:(\d+(\.\d+)*)", "python"),
    (r"(^|/)cimg/go:(\d+(\.\d+)*)", "go"),
    (r"(^|/)cimg/rust:(\d+(\.\d+)*)", "rust"),
    (r"(^|/)cimg/ruby:(\d+(\.\d+)*)", "ruby"),
    (r"(^|/)cimg/openjdk:(\d+(\.\d+)*)", "java"),
    (r"(^|/)mcr.microsoft.com/dotnet/sdk:(\d+(\.\d+)*)", "dotnet"),
]


def image_toolchain(image):
    """(tool, version) implied by a container image tag, if recognisable."""
    if not image:
        return None
    for pattern, tool in _IMAGE_TOOLS:
        m = re.search(pattern, image)
        if m:
            version = next((g for g in m.groups()[1:] if g and re.match(r"^\d", g)), None)
            if version:
                return tool, version
    return None
