"""GitLab CI, CircleCI, Buildkite, Azure Pipelines and Jenkins, translated
into the same check records as GitHub Actions."""

import copy
import glob
import itertools
import os
import re

import common
import github_actions
import yaml_lite


class Result(object):
    def __init__(self):
        self.checks = []
        self.sources = []
        self.unparsed = []
        self.notes = []


def _load(root, rel, result):
    try:
        data = yaml_lite.load(os.path.join(root, rel))
    except (yaml_lite.YamlError, OSError) as exc:
        result.unparsed.append({"file": rel, "reason": str(exc)})
        return None
    result.sources.append(rel)
    return data


def _list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _flatten_script(value):
    out = []
    for item in _list(value):
        if isinstance(item, list):
            out.extend(_flatten_script(item))
        elif item is not None:
            out.append(str(item))
    return out


def _deep_merge(base, over):
    if not isinstance(base, dict) or not isinstance(over, dict):
        return copy.deepcopy(over)
    out = copy.deepcopy(base)
    for key, value in over.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = copy.deepcopy(value)
    return out


def _env_vars(text):
    return set(re.findall(r"\$\{?([A-Z][A-Z0-9_]*)\}?", text or ""))


def _secretish(names):
    return sorted(n for n in names if re.search(r"TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|PRIVATE|CREDENTIAL|AUTH", n))


def _mark_secrets(check, texts):
    names = set()
    for text in texts:
        names |= _env_vars(text)
    declared = set(check["env"])
    check["secrets"] = sorted(set(check["secrets"]) | set(n for n in _secretish(names) if n not in declared))


# ==========================================================================
# GitLab CI
# ==========================================================================
GITLAB_RESERVED = {
    "stages", "variables", "default", "include", "workflow", "image", "services",
    "before_script", "after_script", "cache", "pages", "spec",
}
GITLAB_PREDEFINED = {
    "CI": "true",
    "CI_PIPELINE_SOURCE": "merge_request_event",
    "CI_MERGE_REQUEST_ID": "local",
}


def gitlab(root, info):
    result = Result()
    rel = ".gitlab-ci.yml"
    if not os.path.exists(os.path.join(root, rel)):
        return result
    data = _load(root, rel, result)
    if not isinstance(data, dict):
        return result
    data = _gitlab_includes(root, data, result, depth=0)
    stages = [str(s) for s in _list(data.get("stages"))] or [".pre", "build", "test", "deploy", ".post"]
    default = data.get("default") if isinstance(data.get("default"), dict) else {}
    for key in ("image", "services", "before_script", "after_script"):
        if key in data and key not in default:
            default[key] = data[key]
    global_vars = _gitlab_vars(data.get("variables"))
    jobs = {k: v for k, v in data.items() if k not in GITLAB_RESERVED and not str(k).startswith(".") and isinstance(v, dict)}
    by_stage = {}
    resolved = {}
    for name, job in jobs.items():
        job = _gitlab_extends(data, job, set())
        job = _gitlab_references(data, job)
        resolved[name] = job
        by_stage.setdefault(str(job.get("stage") or "test"), []).append(name)
    for name, job in resolved.items():
        if "trigger" in job:
            continue
        stage = str(job.get("stage") or "test")
        merged = _deep_merge(default, job) if default else job
        combos = _gitlab_matrix(merged.get("parallel"))
        for combo in combos:
            check_name = name + (" [%s]" % ", ".join(str(v) for v in combo.values()) if combo else "")
            check_id = "gitlab." + common.slug(name, *combo.values()) if combo else "gitlab." + common.slug(name)
            check = common.new_check("gitlab-ci", check_id, check_name, "%s#%s" % (rel, name), rel)
            check["job"] = name
            check["workflow"] = "stage " + stage
            env = dict(GITLAB_PREDEFINED)
            env.update(global_vars)
            env.update(_gitlab_vars(merged.get("variables")))
            env.update({k: str(v) for k, v in (combo or {}).items()})
            check["env"] = {k: v for k, v in env.items() if k not in GITLAB_PREDEFINED or k == "CI"}
            image = merged.get("image")
            image = image.get("name") if isinstance(image, dict) else image
            if image:
                check["container"] = _expand(str(image), env)
                check["notes"].append("CI runs this job inside %s" % check["container"])
                hint = github_actions.image_toolchain(check["container"])
                if hint:
                    check["toolchain"][hint[0]] = {"version": hint[1], "source": "image %s" % check["container"]}
            for svc in _list(merged.get("services")):
                svc_name = svc.get("name") if isinstance(svc, dict) else svc
                alias = (svc.get("alias") if isinstance(svc, dict) else None) or str(svc_name).split(":")[0].split("/")[-1]
                check["services"].append({"name": alias, "image": _expand(str(svc_name), env), "ports": [], "env": {}})
            script = _flatten_script(merged.get("before_script")) + _flatten_script(merged.get("script"))
            if script:
                check["steps"].append(common.step("script", "\n".join(script), shell="bash"))
            after = _flatten_script(merged.get("after_script"))
            if after:
                check["steps"].append(common.step("after_script", "\n".join(after), continue_on_error=True))
            needs = merged.get("needs")
            if needs is not None:
                check["needs"] = ["gitlab." + common.slug(n.get("job") if isinstance(n, dict) else n) for n in _list(needs)]
            else:
                idx = stages.index(stage) if stage in stages else 0
                check["needs"] = ["gitlab." + common.slug(n) for s in stages[:idx] for n in by_stage.get(s, [])]
            in_pr, note, paths = _gitlab_rules(merged)
            check["in_pr"] = in_pr
            check["trigger"] = note
            if paths:
                check["path_filters"] = {"include": paths, "exclude": []}
            if merged.get("allow_failure") is True:
                check["notes"].append("allow_failure: true (does not block the pipeline)")
            if merged.get("when") == "manual":
                check["in_pr"] = False
                check["trigger"] = "manual job"
            timeout = merged.get("timeout")
            if timeout:
                check["notes"].append("CI timeout %s" % timeout)
            _mark_secrets(check, script)
            result.checks.append(check)
    return result


def _gitlab_vars(raw):
    out = {}
    if isinstance(raw, dict):
        for key, value in raw.items():
            if isinstance(value, dict):
                value = value.get("value")
            out[str(key)] = "" if value is None else str(value)
    return out


def _expand(text, env):
    return re.sub(r"\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?", lambda m: env.get(m.group(1), m.group(0)), text)


def _gitlab_includes(root, data, result, depth):
    includes = data.get("include")
    if not includes or depth > 5:
        return data
    merged = {}
    for inc in _list(includes):
        local = None
        if isinstance(inc, str):
            if inc.startswith(("http://", "https://")):
                result.notes.append("remote include %s not read" % inc)
                continue
            local = inc
        elif isinstance(inc, dict):
            local = inc.get("local")
            if not local:
                kinds = ", ".join(k for k in inc if k in ("project", "remote", "template", "component"))
                result.notes.append("GitLab include (%s) not read; jobs it defines are missing from the manifest" % (kinds or inc))
                continue
        for path in sorted(glob.glob(os.path.join(root, str(local).lstrip("/")))):
            rel = os.path.relpath(path, root)
            sub = _load(root, rel, result)
            if isinstance(sub, dict):
                merged = _deep_merge(merged, _gitlab_includes(root, sub, result, depth + 1))
    rest = {k: v for k, v in data.items() if k != "include"}
    return _deep_merge(merged, rest)


def _gitlab_extends(data, job, seen):
    parents = _list(job.get("extends"))
    if not parents:
        return job
    base = {}
    for parent in parents:
        if parent in seen or not isinstance(data.get(parent), dict):
            continue
        base = _deep_merge(base, _gitlab_extends(data, data[parent], seen | {parent}))
    out = _deep_merge(base, {k: v for k, v in job.items() if k != "extends"})
    return out


def _gitlab_references(data, node):
    if isinstance(node, dict):
        if set(node) == {"!reference"}:
            path = node["!reference"] or []
            value = data
            for key in path:
                value = value.get(key) if isinstance(value, dict) else None
            return copy.deepcopy(value)
        return {k: _gitlab_references(data, v) for k, v in node.items()}
    if isinstance(node, list):
        out = []
        for item in node:
            value = _gitlab_references(data, item)
            if isinstance(item, dict) and set(item) == {"!reference"} and isinstance(value, list):
                out.extend(value)
            else:
                out.append(value)
        return out
    return node


def _gitlab_matrix(parallel):
    if not isinstance(parallel, dict) or not isinstance(parallel.get("matrix"), list):
        return [None]
    combos = []
    for entry in parallel["matrix"]:
        if not isinstance(entry, dict):
            continue
        axes = {k: (v if isinstance(v, list) else [v]) for k, v in entry.items()}
        for values in itertools.product(*axes.values()):
            combos.append(dict(zip(axes, values)))
    return combos or [None]


def _gitlab_rules(job):
    rules = job.get("rules")
    if isinstance(rules, list):
        paths = []
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            cond = str(rule.get("if") or "")
            changes = rule.get("changes")
            if isinstance(changes, dict):
                changes = changes.get("paths")
            if rule.get("when") == "never":
                if "merge_request_event" in cond and "!=" not in cond:
                    return False, "rules exclude merge request pipelines", None
                continue
            if not cond or "merge_request" in cond or "CI_PIPELINE_SOURCE" not in cond:
                if changes:
                    paths.extend(str(c) for c in _list(changes))
                if rule.get("when") == "manual":
                    return False, "manual in merge requests", None
                return True, "rules: %s" % (cond or "always"), paths or None
        return False, "no rule matches a merge request pipeline", None
    only = job.get("only")
    except_ = job.get("except")
    only_refs = only if isinstance(only, list) else (only or {}).get("refs") if isinstance(only, dict) else None
    except_refs = except_ if isinstance(except_, list) else (except_ or {}).get("refs") if isinstance(except_, dict) else None
    if only_refs and "merge_requests" not in only_refs and "branches" not in only_refs:
        return False, "only: %s" % ", ".join(map(str, only_refs)), None
    if except_refs and "merge_requests" in except_refs:
        return False, "except: merge_requests", None
    changes = (only or {}).get("changes") if isinstance(only, dict) else None
    return True, "every pipeline", [str(c) for c in _list(changes)] or None


# ==========================================================================
# CircleCI
# ==========================================================================
def circleci(root, info):
    result = Result()
    rel = ".circleci/config.yml"
    if not os.path.exists(os.path.join(root, rel)):
        return result
    data = _load(root, rel, result)
    if not isinstance(data, dict):
        return result
    jobs = data.get("jobs") or {}
    executors = data.get("executors") or {}
    commands = data.get("commands") or {}
    pipeline_params = {k: (v or {}).get("default") for k, v in (data.get("parameters") or {}).items() if isinstance(v, dict)}
    if data.get("orbs"):
        result.notes.append("orbs used (%s): orb jobs and commands are listed but not expanded" % ", ".join(data["orbs"]))
    if data.get("setup") is True:
        result.notes.append("dynamic config (setup: true): the continued pipeline is generated at run time")
    plan = []
    for wf_name, wf in (data.get("workflows") or {}).items():
        if not isinstance(wf, dict):
            continue
        for entry in _list(wf.get("jobs")):
            if isinstance(entry, str):
                plan.append((wf_name, entry, {}))
            elif isinstance(entry, dict):
                for job_name, cfg in entry.items():
                    plan.append((wf_name, job_name, cfg or {}))
    if not plan:
        plan = [("default", name, {}) for name in jobs]
    for wf_name, job_name, cfg in plan:
        matrix = (cfg.get("matrix") or {}).get("parameters") if isinstance(cfg.get("matrix"), dict) else None
        combos = [dict(zip(matrix, vals)) for vals in itertools.product(*[_list(v) for v in matrix.values()])] if matrix else [{}]
        for combo in combos:
            params = {k: v for k, v in cfg.items() if k not in ("requires", "filters", "context", "matrix", "name", "type")}
            params.update(combo)
            display = cfg.get("name") or (job_name + ("-" + "-".join(str(v) for v in combo.values()) if combo else ""))
            check_id = "circleci." + common.slug(wf_name, display)
            check = common.new_check("circleci", check_id, str(display), "%s#jobs.%s" % (rel, job_name), rel)
            check["workflow"] = wf_name
            check["job"] = job_name
            check["needs"] = ["circleci." + common.slug(wf_name, r) for r in _list(cfg.get("requires"))]
            contexts = _list(cfg.get("context"))
            if contexts:
                check["secrets"] = ["CircleCI context %s" % c for c in contexts]
            branches = ((cfg.get("filters") or {}).get("branches") or {}) if isinstance(cfg.get("filters"), dict) else {}
            if branches.get("only") and not any(re.fullmatch(str(b).strip("/"), info["branch"]) or b == info["branch"] for b in _list(branches["only"])):
                check["in_pr"] = False
                check["trigger"] = "branches only: %s" % ", ".join(map(str, _list(branches["only"])))
            else:
                check["trigger"] = "workflow %s" % wf_name
            if cfg.get("type") == "approval":
                check["in_pr"] = False
                check["trigger"] = "approval gate"
                result.checks.append(check)
                continue
            job = jobs.get(job_name)
            if not isinstance(job, dict):
                check["local"]["reasons"].append("job %s comes from an orb; translate it by hand" % job_name)
                result.checks.append(check)
                continue
            defaults = {k: (v or {}).get("default") for k, v in (job.get("parameters") or {}).items() if isinstance(v, dict)}
            defaults.update(params)
            job = _circle_params(job, defaults, pipeline_params)
            executor = job.get("executor")
            if executor:
                ex_name = executor if isinstance(executor, str) else executor.get("name")
                job = _deep_merge(executors.get(ex_name) or {}, job)
            docker = _list(job.get("docker"))
            if docker:
                primary = docker[0] if isinstance(docker[0], dict) else {"image": docker[0]}
                check["container"] = primary.get("image")
                hint = github_actions.image_toolchain(check["container"] or "")
                if hint:
                    check["toolchain"][hint[0]] = {"version": hint[1], "source": "image %s" % check["container"]}
                check["env"].update({str(k): str(v) for k, v in (primary.get("environment") or {}).items()})
                for svc in docker[1:]:
                    svc = svc if isinstance(svc, dict) else {"image": svc}
                    name = svc.get("name") or str(svc.get("image", "service")).split(":")[0].split("/")[-1]
                    check["services"].append({"name": name, "image": svc.get("image"), "ports": [],
                                              "env": {str(k): str(v) for k, v in (svc.get("environment") or {}).items()}})
            elif job.get("macos"):
                check["os"] = "macos"
            elif job.get("machine"):
                check["os"] = "linux"
            if docker:
                check["os"] = "linux"
            check["env"].update({str(k): str(v) for k, v in (job.get("environment") or {}).items()})
            wd = job.get("working_directory")
            for idx, step in enumerate(_list(job.get("steps"))):
                check["steps"].extend(_circle_step(step, idx, commands, defaults, pipeline_params, wd, 0))
            _mark_secrets(check, [s.get("run") or "" for s in check["steps"]])
            if check["os"] == "macos" and info["host_os"] != "darwin":
                check["local"]["reasons"].append("runs on macOS in CI")
            result.checks.append(check)
    return result


def _circle_params(node, params, pipeline):
    if isinstance(node, dict):
        return {k: _circle_params(v, params, pipeline) for k, v in node.items()}
    if isinstance(node, list):
        return [_circle_params(v, params, pipeline) for v in node]
    if isinstance(node, str):
        node = re.sub(r"<<\s*parameters\.([\w-]+)\s*>>", lambda m: str(params.get(m.group(1), m.group(0))), node)
        node = re.sub(r"<<\s*pipeline\.parameters\.([\w-]+)\s*>>", lambda m: str(pipeline.get(m.group(1), m.group(0))), node)
    return node


def _circle_step(step, idx, commands, params, pipeline, wd, depth):
    if isinstance(step, str):
        if step == "checkout":
            return [common.step("checkout", local="skip", note="checkout")]
        if step in commands and depth < 5:
            return _circle_command(step, {}, commands, params, pipeline, wd, depth)
        return [common.step(step, local="ci-only", note="orb or built-in step %s; translate it by hand" % step)]
    if not isinstance(step, dict) or not step:
        return []
    key, value = next(iter(step.items()))
    if key == "run":
        if isinstance(value, str):
            return [common.step(value.splitlines()[0][:60], value, cwd=wd or ".")]
        cmd = value.get("command") or ""
        name = value.get("name") or cmd.splitlines()[0][:60]
        entry = common.step(str(name), str(cmd), cwd=value.get("working_directory") or wd or ".",
                            env={str(k): str(v) for k, v in (value.get("environment") or {}).items()})
        if value.get("background"):
            entry.update(local="ci-only", note="background process; start it as a service")
        if value.get("when") in ("on_fail",):
            entry.update(local="skip", note="runs only on failure")
        return [entry]
    if key in ("restore_cache", "save_cache", "persist_to_workspace", "attach_workspace",
               "store_artifacts", "store_test_results", "setup_remote_docker", "add_ssh_keys"):
        return [common.step(key, local="skip", note="CircleCI %s" % key)]
    if key == "when" or key == "unless":
        inner = []
        for i, s in enumerate(_list((value or {}).get("steps"))):
            inner.extend(_circle_step(s, i, commands, params, pipeline, wd, depth + 1))
        return inner
    if key in commands and depth < 5:
        return _circle_command(key, value or {}, commands, params, pipeline, wd, depth)
    return [common.step(key, local="ci-only", note="orb command %s; translate it by hand" % key)]


def _circle_command(name, args, commands, params, pipeline, wd, depth):
    cmd = commands[name] or {}
    local = {k: (v or {}).get("default") for k, v in (cmd.get("parameters") or {}).items() if isinstance(v, dict)}
    local.update(args if isinstance(args, dict) else {})
    body = _circle_params(cmd, local, pipeline)
    out = []
    for i, s in enumerate(_list(body.get("steps"))):
        out.extend(_circle_step(s, i, commands, local, pipeline, wd, depth + 1))
    return out


# ==========================================================================
# Buildkite
# ==========================================================================
def buildkite(root, info):
    result = Result()
    candidates = [".buildkite/pipeline.yml", ".buildkite/pipeline.yaml", "buildkite.yml", "buildkite.yaml", ".buildkite/pipeline.json"]
    rel = next((c for c in candidates if os.path.exists(os.path.join(root, c))), None)
    if not rel:
        return result
    data = _load(root, rel, result)
    steps = data.get("steps") if isinstance(data, dict) else data
    env = {str(k): str(v) for k, v in ((data.get("env") if isinstance(data, dict) else None) or {}).items()}
    prior = []
    for step in _buildkite_flatten(_list(steps)):
        if step == "wait" or (isinstance(step, dict) and ("wait" in step or "waiter" in step)):
            prior = [c["id"] for c in result.checks]
            continue
        if not isinstance(step, dict):
            continue
        if "block" in step or "input" in step:
            result.notes.append("manual block step %r: later steps wait for a person in CI" % (step.get("block") or step.get("input")))
            continue
        if "trigger" in step:
            result.notes.append("trigger step starts pipeline %s; not reproduced locally" % step["trigger"])
            continue
        commands = _flatten_script(step.get("command") or step.get("commands"))
        label = str(step.get("label") or step.get("name") or step.get("key") or (commands[0] if commands else "step"))
        key = step.get("key") or step.get("id") or label
        check = common.new_check("buildkite", "buildkite." + common.slug(key), label, "%s#%s" % (rel, key), rel)
        check["env"] = dict(env, **{str(k): str(v) for k, v in (step.get("env") or {}).items()})
        deps = _list(step.get("depends_on"))
        check["needs"] = ["buildkite." + common.slug(d.get("step") if isinstance(d, dict) else d) for d in deps] if deps else list(prior)
        for plugin in _list(step.get("plugins")):
            for pname, pcfg in (plugin.items() if isinstance(plugin, dict) else [(plugin, {})]):
                pcfg = pcfg or {}
                if pname.startswith("docker#") or pname.startswith("docker-buildkite-plugin"):
                    check["container"] = pcfg.get("image")
                    hint = github_actions.image_toolchain(check["container"] or "")
                    if hint:
                        check["toolchain"][hint[0]] = {"version": hint[1], "source": "docker plugin %s" % check["container"]}
                elif pname.startswith("docker-compose#"):
                    check["notes"].append("runs in docker compose service %s" % pcfg.get("run"))
                else:
                    check["notes"].append("plugin %s is not reproduced locally" % pname)
        script = "\n".join(commands)
        if "buildkite-agent pipeline upload" in script:
            check["notes"].append("uploads a generated pipeline: the steps it adds are only known at run time")
        if script:
            check["steps"].append(common.step(label, script))
        branches = step.get("branches")
        if branches and info["branch"] not in str(branches).split():
            check["notes"].append("branch filter: %s" % branches)
        if step.get("if"):
            check["notes"].append("runs only if: %s" % step["if"])
        if step.get("soft_fail"):
            check["notes"].append("soft_fail: does not fail the build")
        _mark_secrets(check, commands)
        result.checks.append(check)
    return result


def _buildkite_flatten(steps):
    for step in steps:
        if isinstance(step, dict) and "group" in step and "steps" in step:
            for inner in _buildkite_flatten(_list(step["steps"])):
                yield inner
        else:
            yield step


# ==========================================================================
# Azure Pipelines
# ==========================================================================
AZURE_TASKS = {
    "NodeTool": ("node", "versionSpec"),
    "UseNode": ("node", "version"),
    "UsePythonVersion": ("python", "versionSpec"),
    "GoTool": ("go", "version"),
    "JavaToolInstaller": ("java", "versionSpec"),
    "UseDotNet": ("dotnet", "version"),
    "UseRubyVersion": ("ruby", "versionSpec"),
}


def azure(root, info):
    result = Result()
    files = [f for f in ("azure-pipelines.yml", "azure-pipelines.yaml", ".azure-pipelines.yml") if os.path.exists(os.path.join(root, f))]
    files += sorted(os.path.relpath(p, root) for p in glob.glob(os.path.join(root, ".azure-pipelines", "*.y*ml")))
    files += sorted(os.path.relpath(p, root) for p in glob.glob(os.path.join(root, ".azuredevops", "*.y*ml")))
    for rel in files:
        data = _load(root, rel, result)
        if not isinstance(data, dict):
            continue
        if "jobs" not in data and "stages" not in data and "steps" not in data:
            continue  # a template, read where it is used
        variables = _azure_vars(data.get("variables"), result)
        pr = data.get("pr")
        in_pr = pr != "none" and pr is not False
        paths = None
        if isinstance(pr, dict):
            branches = (pr.get("branches") or {}).get("include") if isinstance(pr.get("branches"), dict) else pr.get("branches")
            if branches and not any(common.path_matches(info["base_branch"], str(b).replace("refs/heads/", "")) for b in _list(branches)):
                in_pr = False
            if isinstance(pr.get("paths"), dict):
                paths = {"include": [str(p) for p in _list(pr["paths"].get("include"))], "exclude": [str(p) for p in _list(pr["paths"].get("exclude"))]}
        stages = data.get("stages") or [{"stage": "default", "jobs": data.get("jobs") or [{"job": "default", "steps": data.get("steps") or [], "pool": data.get("pool")}]}]
        for stage in _list(stages):
            if not isinstance(stage, dict):
                continue
            if "template" in stage:
                result.notes.append("stage template %s not expanded" % stage["template"])
                continue
            stage_name = str(stage.get("stage") or "default")
            for job in _list(stage.get("jobs")):
                if not isinstance(job, dict):
                    continue
                if "template" in job:
                    result.notes.append("job template %s not expanded" % job["template"])
                    continue
                job_name = str(job.get("job") or job.get("deployment") or "job")
                pool = job.get("pool") or data.get("pool") or {}
                image = pool.get("vmImage") if isinstance(pool, dict) else str(pool)
                matrix = ((job.get("strategy") or {}).get("matrix")) if isinstance(job.get("strategy"), dict) else None
                legs = matrix.items() if isinstance(matrix, dict) else [(None, {})]
                for leg, leg_vars in legs:
                    display = str(job.get("displayName") or job_name) + (" %s" % leg if leg else "")
                    check_id = "azure." + common.slug(os.path.splitext(os.path.basename(rel))[0], stage_name, job_name, leg)
                    check = common.new_check("azure-pipelines", check_id, display, "%s#%s.%s" % (rel, stage_name, job_name), rel)
                    check["workflow"] = stage_name
                    check["job"] = job_name
                    check["in_pr"] = in_pr
                    check["trigger"] = "pr trigger" if in_pr else "not triggered by pull requests"
                    check["path_filters"] = paths
                    check["runs_on"] = image
                    check["os"] = github_actions.runner_os(image or "")
                    env = dict(variables)
                    env.update(_azure_vars(job.get("variables"), result))
                    env.update({str(k): str(v) for k, v in (leg_vars or {}).items()})
                    check["env"] = env
                    if "deployment" in job:
                        check["local"]["reasons"].append("deployment job")
                    deps = _list(job.get("dependsOn"))
                    check["needs"] = ["azure." + common.slug(os.path.splitext(os.path.basename(rel))[0], stage_name, d) for d in deps]
                    for idx, step in enumerate(_list(job.get("steps"))):
                        check["steps"].extend(_azure_step(root, step, env, check, result, 0))
                    if check["os"] == "windows" and info["host_os"] != "windows":
                        check["local"]["reasons"].append("runs on Windows in CI")
                    _mark_secrets(check, [s.get("run") or "" for s in check["steps"]])
                    result.checks.append(check)
    return result


def _azure_vars(raw, result):
    out = {}
    if isinstance(raw, dict):
        out.update({str(k): str(v) for k, v in raw.items()})
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and "name" in item:
                out[str(item["name"])] = str(item.get("value", ""))
            elif isinstance(item, dict) and "group" in item:
                result.notes.append("variable group %s holds values only Azure DevOps can read" % item["group"])
    return out


def _azure_macros(text, env):
    return re.sub(r"\$\(([\w.]+)\)", lambda m: env.get(m.group(1), m.group(0)), text)


def _azure_step(root, step, env, check, result, depth):
    if not isinstance(step, dict):
        return []
    if "template" in step:
        path = os.path.join(root, str(step["template"]))
        if depth < 5 and os.path.exists(path):
            data = _load(root, os.path.relpath(path, root), result) or {}
            params = {k: (v or {}).get("default") for k, v in _azure_params(data.get("parameters")).items()}
            params.update(step.get("parameters") or {})
            out = []
            for inner in _list(data.get("steps")):
                inner = _azure_template_params(inner, params)
                out.extend(_azure_step(root, inner, env, check, result, depth + 1))
            return out
        return [common.step("template %s" % step["template"], local="ci-only", note="remote or missing template")]
    name = str(step.get("displayName") or step.get("name") or next(iter(step)))
    step_env = {str(k): str(v) for k, v in (step.get("env") or {}).items()}
    cwd = _azure_macros(str(step.get("workingDirectory") or "."), env)
    cwd = cwd.replace("$(System.DefaultWorkingDirectory)", ".").replace("$(Build.SourcesDirectory)", ".")
    if step.get("condition"):
        note = "condition: %s" % step["condition"]
    else:
        note = None
    for key, shell in (("script", "bash"), ("bash", "bash"), ("pwsh", "pwsh"), ("powershell", "pwsh")):
        if key in step:
            entry = common.step(name, _azure_macros(str(step[key]), env), cwd=cwd, env=step_env, shell=shell)
            if note:
                entry["note"] = note
            return [entry]
    if "checkout" in step:
        return [common.step(name, local="skip", note="checkout")]
    task = str(step.get("task") or "")
    task_name = task.split("@")[0]
    inputs = step.get("inputs") or {}
    if task_name in AZURE_TASKS:
        tool, key = AZURE_TASKS[task_name]
        if inputs.get(key):
            check["toolchain"][tool] = {"version": str(inputs[key]), "source": "%s task in %s" % (task, check["file"])}
        return [common.step(name, local="skip", kind="toolchain", note="toolchain %s" % tool)]
    if task_name == "Npm":
        command = inputs.get("command") or "install"
        cmd = "npm %s" % (inputs.get("customCommand") if command == "custom" else command)
        return [common.step(name, cmd, cwd=inputs.get("workingDir") or cwd)]
    if task_name == "DotNetCoreCLI":
        cmd = "dotnet %s %s %s" % (inputs.get("command") or "build", inputs.get("projects") or "", inputs.get("arguments") or "")
        return [common.step(name, cmd.strip(), cwd=cwd)]
    if task_name in ("PublishTestResults", "PublishCodeCoverageResults", "PublishBuildArtifacts", "PublishPipelineArtifact", "DownloadPipelineArtifact", "Cache"):
        return [common.step(name, local="skip", note=task_name)]
    return [common.step(name, local="ci-only", note="Azure task %s: translate it by hand" % task)]


def _azure_params(raw):
    if isinstance(raw, dict):
        return {k: {"default": v} for k, v in raw.items()}
    out = {}
    for item in _list(raw):
        if isinstance(item, dict) and "name" in item:
            out[str(item["name"])] = item
    return out


def _azure_template_params(node, params):
    if isinstance(node, dict):
        return {k: _azure_template_params(v, params) for k, v in node.items()}
    if isinstance(node, list):
        return [_azure_template_params(v, params) for v in node]
    if isinstance(node, str):
        return re.sub(r"\$\{\{\s*parameters\.([\w-]+)\s*\}\}", lambda m: str(params.get(m.group(1), m.group(0))), node)
    return node


# ==========================================================================
# Jenkins (declarative and scripted, read heuristically)
# ==========================================================================
def jenkins(root, info):
    result = Result()
    rel = next((f for f in ("Jenkinsfile", "jenkins/Jenkinsfile", "ci/Jenkinsfile") if os.path.exists(os.path.join(root, f))), None)
    if not rel:
        return result
    text = common.read_text(os.path.join(root, rel)) or ""
    result.sources.append(rel)
    result.notes.append("%s is Groovy: stages and sh steps were read heuristically; check them against the file" % rel)
    image = re.search(r"image\s+['\"]([^'\"]+)['\"]|docker\.image\(\s*['\"]([^'\"]+)['\"]", text)
    image = (image.group(1) or image.group(2)) if image else None
    prev = []
    for name, body in _jenkins_stages(text):
        if re.search(r"\bstage\s*\(", body):
            continue  # a parent of nested stages; the leaves carry the work
        commands = _jenkins_sh(body)
        bats = re.findall(r"\b(bat|powershell)\s*[\(\s]", body)
        check = common.new_check("jenkins", "jenkins." + common.slug(name), name, "%s#stage(%s)" % (rel, name), rel)
        check["container"] = image
        hint = github_actions.image_toolchain(image or "")
        if hint:
            check["toolchain"][hint[0]] = {"version": hint[1], "source": "agent image %s" % image}
        check["needs"] = list(prev)
        when = re.search(r"when\s*\{([^}]*)\}", body)
        if when:
            cond = when.group(1).strip()
            check["notes"].append("when { %s }" % " ".join(cond.split()))
            if re.search(r"branch\s+['\"](main|master|release)", cond) and "changeRequest" not in cond:
                check["in_pr"] = False
                check["trigger"] = "only on %s" % cond.strip()
        for idx, cmd in enumerate(commands):
            check["steps"].append(common.step("sh %d" % (idx + 1), cmd))
        if bats and not commands:
            check["local"]["reasons"].append("runs Windows batch / PowerShell steps")
        creds = re.findall(r"credentials\(\s*['\"]([^'\"]+)['\"]", body + text[:2000])
        if creds:
            check["secrets"] = sorted(set("Jenkins credential %s" % c for c in creds))
        if not commands and not bats:
            check["local"]["reasons"].append("no sh steps found; read the stage by hand")
        _mark_secrets(check, commands)
        result.checks.append(check)
        if "parallel" not in body:
            prev = [check["id"]]
    return result


def _jenkins_block(text, start):
    """Body between the `{` at/after start and its matching `}`."""
    i = text.find("{", start)
    if i == -1:
        return "", start
    depth = 0
    quote = None
    j = i
    while j < len(text):
        c = text[j]
        if quote:
            if text.startswith(quote, j) and text[j - 1] != "\\":
                j += len(quote)
                quote = None
                continue
        else:
            for q in ("'''", '"""', "'", '"'):
                if text.startswith(q, j):
                    quote = q
                    j += len(q) - 1
                    break
            else:
                if c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        return text[i + 1:j], j + 1
        j += 1
    return text[i + 1:], len(text)


def _jenkins_stages(text):
    for m in re.finditer(r"\bstage\s*\(\s*['\"]([^'\"]+)['\"]\s*\)", text):
        body, _ = _jenkins_block(text, m.end())
        yield m.group(1), body


def _jenkins_sh(body):
    out = []
    pattern = re.compile(
        r"\bsh\s*(?:\(\s*(?:script\s*:\s*)?|(?:label\s*:\s*['\"][^'\"]*['\"]\s*,\s*)?script\s*:\s*|\s+)"
        r"(?P<q>'''|\"\"\"|'|\")(?P<cmd>.*?)(?P=q)",
        re.S,
    )
    for m in pattern.finditer(body):
        cmd = m.group("cmd")
        if m.group("q") in ("'''", '"""'):
            lines = cmd.strip("\n").splitlines()
            indent = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
            cmd = "\n".join(l[indent:] for l in lines)
        out.append(cmd.strip())
    return out
