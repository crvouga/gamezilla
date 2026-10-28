"""Repo-local configuration the CI commands lean on: git hook frameworks
(pre-commit, lefthook, husky), task runners (Makefile, justfile,
package.json, tox, nox) and toolchain version files."""

import configparser
import json
import os
import re
import shlex

import common
import yaml_lite

try:  # Python 3.11+
    import tomllib
except ImportError:  # pragma: no cover - older interpreters
    tomllib = None


# ==========================================================================
# Hooks
# ==========================================================================
def hooks(root, changed, ci_text):
    """Checks for hook frameworks. A hook is a CI check only when CI runs it
    (pre-commit.ci, or a workflow that calls it); otherwise it is local-only."""
    checks, sources, notes = [], [], []
    rel = ".pre-commit-config.yaml"
    path = os.path.join(root, rel)
    if os.path.exists(path):
        sources.append(rel)
        try:
            data = yaml_lite.load(path) or {}
        except yaml_lite.YamlError as exc:
            data = {}
            notes.append("%s: %s" % (rel, exc))
        hook_ids = []
        for repo in data.get("repos") or []:
            for hook in (repo or {}).get("hooks") or []:
                if isinstance(hook, dict) and hook.get("id"):
                    stages = hook.get("stages")
                    if stages and not any(s in ("pre-commit", "commit", "pre-push", "push", "manual") for s in stages):
                        continue
                    hook_ids.append(str(hook["id"]))
        by_ci = "pre-commit" in ci_text
        hosted = "ci" in data
        check = common.new_check("pre-commit", "hooks.pre-commit", "pre-commit.ci - pr" if hosted else "pre-commit", rel, rel)
        check["in_pr"] = bool(hosted or by_ci)
        check["trigger"] = "pre-commit.ci on pull requests" if hosted else ("called from CI" if by_ci else "local git hook only (not a CI check)")
        check["steps"] = [common.step("pre-commit (%d hooks)" % len(hook_ids), "pre-commit run --all-files --show-diff-on-failure --color=always")]
        check["steps"][0]["requires"] = ["pre-commit"]
        check["hooks"] = hook_ids
        check["notes"].append("formatter hooks rewrite files in place: review the diff they leave as part of the fix")
        checks.append(check)
    for rel in ("lefthook.yml", ".lefthook.yml", "lefthook.yaml", ".lefthook.yaml", ".config/lefthook.yml"):
        path = os.path.join(root, rel)
        if not os.path.exists(path):
            continue
        sources.append(rel)
        try:
            data = yaml_lite.load(path) or {}
        except yaml_lite.YamlError as exc:
            notes.append("%s: %s" % (rel, exc))
            continue
        for hook_name in ("pre-commit", "pre-push"):
            hook = data.get(hook_name)
            if not isinstance(hook, dict):
                continue
            check = common.new_check("lefthook", "hooks.lefthook." + hook_name, "lefthook %s" % hook_name, "%s#%s" % (rel, hook_name), rel)
            check["in_pr"] = "lefthook" in ci_text
            check["trigger"] = "called from CI" if check["in_pr"] else "local git hook only (not a CI check)"
            for name, cmd in (hook.get("commands") or {}).items():
                if not isinstance(cmd, dict) or not cmd.get("run"):
                    continue
                run = _lefthook_files(str(cmd["run"]), cmd.get("glob"), changed)
                if run is None:
                    check["steps"].append(common.step(str(name), local="skip", note="no changed files match %s" % cmd.get("glob")))
                    continue
                check["steps"].append(common.step(str(name), run, cwd=cmd.get("root") or "."))
            for name, script in (hook.get("scripts") or {}).items():
                runner = (script or {}).get("runner") or "sh"
                check["steps"].append(common.step(str(name), "%s .lefthook/%s/%s" % (runner, hook_name, name)))
            checks.append(check)
        break
    husky = os.path.join(root, ".husky")
    if os.path.isdir(husky):
        for hook_name in ("pre-commit", "pre-push"):
            path = os.path.join(husky, hook_name)
            if not os.path.isfile(path):
                continue
            rel = ".husky/" + hook_name
            sources.append(rel)
            body = common.read_text(path) or ""
            check = common.new_check("husky", "hooks.husky." + hook_name, "husky %s" % hook_name, rel, rel)
            check["in_pr"] = False
            check["trigger"] = "local git hook only (not a CI check)"
            check["steps"] = [common.step(hook_name, "sh %s" % rel)]
            if "lint-staged" in body:
                check["notes"].append("lint-staged runs only on staged files; CI usually runs the same tools on everything")
            checks.append(check)
    return checks, sources, notes


def _lefthook_files(run, glob_pattern, changed):
    placeholders = ("{staged_files}", "{push_files}", "{files}", "{all_files}")
    if not any(p in run for p in placeholders):
        return run
    files = changed
    if glob_pattern:
        globs = glob_pattern if isinstance(glob_pattern, list) else [glob_pattern]
        files = [f for f in changed if any(common.path_matches(f, g) or common.path_matches(os.path.basename(f), g) for g in globs)]
    if not files:
        return None
    joined = " ".join(shlex.quote(f) for f in files)
    for p in placeholders:
        run = run.replace(p, joined)
    return run


# ==========================================================================
# Task runners
# ==========================================================================
_NPM_RUN = re.compile(r"^(?:npm|pnpm|yarn|bun)(?:\s+--?[\w-]+(?:=\S+)?)*\s+(?:run(?:-script)?\s+)?(?P<script>[\w:.\-/@]+)")
_NPM_BUILTIN = {"install", "i", "ci", "add", "exec", "dlx", "x", "create", "publish", "pack", "audit", "outdated", "update", "remove", "link", "why", "init", "info", "version", "--version", "-v"}


def resolve_task(root, cwd, command, depth=0):
    """What a task-runner invocation runs: [{runner, target, file, commands}]."""
    out = []
    base = os.path.normpath(os.path.join(root, cwd or "."))
    for line in command.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        for part in re.split(r"\s*(?:&&|\|\||;)\s*", line):
            part = re.sub(r"^(?:\w+=\S+\s+)+", "", part.strip())
            hit = _resolve_one(base, part)
            if hit:
                out.append(hit)
                if depth < 1:
                    for cmd in hit["commands"][:5]:
                        for inner in resolve_task(root, os.path.relpath(base, root), cmd, depth + 1):
                            out.append(inner)
    return out


def _resolve_one(base, part):
    tokens = part.split()
    if not tokens:
        return None
    head = tokens[0]
    if head in ("npm", "pnpm", "yarn", "bun"):
        if head == "npm" and len(tokens) > 1 and tokens[1] in ("test", "t"):
            name = "test"
        elif head == "npm" and len(tokens) > 1 and tokens[1] not in ("run", "run-script"):
            return None
        else:
            m = _NPM_RUN.match(part)
            if not m or m.group("script") in _NPM_BUILTIN or (head == "bun" and m.group("script") in ("test", "x")):
                return None
            name = m.group("script")
        pkg = _find_up(base, "package.json")
        if not pkg:
            return None
        data = common.read_json(pkg, {}) or {}
        script = (data.get("scripts") or {}).get(name)
        if script is None:
            return None
        return {"runner": head, "target": name, "file": pkg, "commands": [script]}
    if head in ("make", "gmake"):
        directory = base
        targets = []
        skip = False
        for idx, tok in enumerate(tokens[1:]):
            if skip:
                skip = False
                continue
            if tok == "-C":
                skip = True
                directory = os.path.join(base, tokens[idx + 2])
                continue
            if tok.startswith("-") or "=" in tok:
                continue
            targets.append(tok)
        makefile = next((os.path.join(directory, f) for f in ("GNUmakefile", "makefile", "Makefile") if os.path.exists(os.path.join(directory, f))), None)
        if not makefile:
            return None
        recipes = _make_recipes(common.read_text(makefile) or "")
        target = targets[0] if targets else next(iter(recipes), None)
        if target not in recipes:
            return None
        deps, lines = recipes[target]
        return {"runner": "make", "target": target, "file": makefile, "commands": lines, "depends_on": deps}
    if head == "just":
        justfile = next((os.path.join(d, f) for d in _parents(base) for f in ("justfile", "Justfile", ".justfile") if os.path.exists(os.path.join(d, f))), None)
        if not justfile:
            return None
        recipes = _just_recipes(common.read_text(justfile) or "")
        target = next((t for t in tokens[1:] if not t.startswith("-")), None) or next(iter(recipes), None)
        if target not in recipes:
            return None
        return {"runner": "just", "target": target, "file": justfile, "commands": recipes[target]}
    if head == "tox":
        envs = []
        for idx, tok in enumerate(tokens):
            if tok == "-e" and idx + 1 < len(tokens):
                envs.extend(tokens[idx + 1].split(","))
        commands = _tox_commands(base, envs)
        if commands is None:
            return None
        return {"runner": "tox", "target": ",".join(envs) or "default", "file": commands[0], "commands": commands[1]}
    if head == "nox":
        noxfile = os.path.join(base, "noxfile.py")
        if not os.path.exists(noxfile):
            return None
        sessions = re.findall(r"@(?:nox\.)?session[^\n]*\n\s*def\s+(\w+)", common.read_text(noxfile) or "")
        target = None
        for idx, tok in enumerate(tokens):
            if tok in ("-s", "--session", "--sessions") and idx + 1 < len(tokens):
                target = tokens[idx + 1]
        return {"runner": "nox", "target": target or "default", "file": noxfile, "commands": ["(session function %s in noxfile.py)" % s for s in sessions if not target or s == target]}
    return None


def _parents(start):
    path = start
    while True:
        yield path
        parent = os.path.dirname(path)
        if parent == path:
            return
        path = parent


def _find_up(start, name):
    for d in _parents(start):
        candidate = os.path.join(d, name)
        if os.path.exists(candidate):
            return candidate
        if os.path.isdir(os.path.join(d, ".git")) or os.path.isfile(os.path.join(d, ".git")):
            return None
    return None


def _make_recipes(text):
    recipes = {}
    current = None
    for line in text.splitlines():
        if line.startswith("\t") and current:
            cmd = line.strip()
            if cmd:
                recipes[current][1].append(cmd.lstrip("@-+ "))
            continue
        m = re.match(r"^([A-Za-z0-9_.\-/%]+(?:\s+[A-Za-z0-9_.\-/%]+)*)\s*::?(?!=)\s*(.*)$", line)
        if m and not line.startswith((" ", "#")):
            names = m.group(1).split()
            deps = [d for d in m.group(2).split(";")[0].split() if not d.startswith("|")]
            current = names[0] if names[0] != ".PHONY" else None
            for name in names:
                if name.startswith("."):
                    continue
                recipes.setdefault(name, (deps, []))
            if current and current.startswith("."):
                current = None
            continue
        if line.strip() and not line.startswith("\t"):
            current = None
    return recipes


def _just_recipes(text):
    recipes = {}
    current = None
    for line in text.splitlines():
        m = re.match(r"^@?([A-Za-z0-9_-]+)(?:\s+[^:=]*)?:(?!=)(.*)$", line)
        if m and not line.startswith((" ", "\t", "#")):
            current = m.group(1)
            recipes[current] = []
            continue
        if current and line.startswith((" ", "\t")) and line.strip():
            recipes[current].append(line.strip().lstrip("@-"))
        elif line.strip() and not line.startswith((" ", "\t")):
            current = None
    return recipes


def _tox_commands(base, envs):
    for name in ("tox.ini", "setup.cfg"):
        path = os.path.join(base, name)
        if not os.path.exists(path):
            continue
        parser = configparser.RawConfigParser(strict=False)
        try:
            parser.read(path)
        except configparser.Error:
            return None
        sections = ["testenv:%s" % e for e in envs] if envs else ["testenv"]
        out = []
        for section in sections:
            sec = section if parser.has_section(section) else "testenv"
            if parser.has_option(sec, "commands"):
                out.extend(l.strip() for l in parser.get(sec, "commands").splitlines() if l.strip())
        return path, out
    return None


# ==========================================================================
# Toolchain pins
# ==========================================================================
ALIASES = {
    "nodejs": "node", "golang": "go", "python3": "python", "pypy": "python",
    "openjdk": "java", "temurin": "java", "zulu": "java", "corretto": "java",
    "rustc": "rust", "tofu": "opentofu", "dotnet-core": "dotnet",
}


def _tool(name):
    name = str(name).strip().lower()
    return ALIASES.get(name, name)


def repo_pins(root):
    """{tool: [{"version", "source"}]} from every version file in the repo root."""
    pins = {}

    def add(tool, version, source):
        if version in (None, ""):
            return
        pins.setdefault(_tool(tool), []).append({"version": str(version).strip(), "source": source})

    tv = common.read_text(os.path.join(root, ".tool-versions"))
    if tv:
        for line in tv.splitlines():
            parts = line.split("#")[0].split()
            if len(parts) >= 2:
                add(parts[0], parts[1], ".tool-versions")
    for rel in ("mise.toml", ".mise.toml", "mise/config.toml", ".mise/config.toml", ".config/mise.toml", ".config/mise/config.toml"):
        text = common.read_text(os.path.join(root, rel))
        if text is None:
            continue
        for tool, version in _mise_tools(text).items():
            add(tool, version, rel)
    for rel, tool in ((".nvmrc", "node"), (".node-version", "node"), (".python-version", "python"),
                      (".ruby-version", "ruby"), (".java-version", "java"), (".go-version", "go"),
                      (".terraform-version", "terraform"), (".opentofu-version", "opentofu"),
                      (".bun-version", "bun"), (".dvmrc", "deno")):
        text = common.read_text(os.path.join(root, rel))
        if text and text.strip():
            add(tool, text.strip().splitlines()[0].strip(), rel)
    pkg = common.read_json(os.path.join(root, "package.json"), None)
    if isinstance(pkg, dict):
        pm = pkg.get("packageManager")
        if isinstance(pm, str) and "@" in pm:
            name, version = pm.split("@", 1)
            add(name, version.split("+")[0], "package.json packageManager")
        engines = pkg.get("engines") or {}
        if isinstance(engines, dict) and engines.get("node"):
            add("node", engines["node"], "package.json engines.node (range)")
        volta = pkg.get("volta") or {}
        if isinstance(volta, dict):
            for tool, version in volta.items():
                add(tool, version, "package.json volta")
    runtime = common.read_text(os.path.join(root, "runtime.txt"))
    if runtime and runtime.startswith("python-"):
        add("python", runtime.strip()[7:], "runtime.txt")
    gomod = common.read_text(os.path.join(root, "go.mod"))
    if gomod:
        m = re.search(r"^toolchain\s+go(\S+)", gomod, re.M) or re.search(r"^go\s+(\S+)", gomod, re.M)
        if m:
            add("go", m.group(1), "go.mod")
    for rel in ("rust-toolchain.toml", "rust-toolchain"):
        text = common.read_text(os.path.join(root, rel))
        if text:
            m = re.search(r"channel\s*=\s*\"([^\"]+)\"", text)
            add("rust", m.group(1) if m else text.strip().splitlines()[0], rel)
            break
    sdkman = common.read_text(os.path.join(root, ".sdkmanrc"))
    if sdkman:
        for line in sdkman.splitlines():
            if "=" in line and not line.startswith("#"):
                tool, version = line.split("=", 1)
                add(tool, version, ".sdkmanrc")
    gjson = common.read_json(os.path.join(root, "global.json"), None)
    if isinstance(gjson, dict) and (gjson.get("sdk") or {}).get("version"):
        add("dotnet", gjson["sdk"]["version"], "global.json")
    pyproject = common.read_text(os.path.join(root, "pyproject.toml"))
    if pyproject:
        m = re.search(r"requires-python\s*=\s*['\"]([^'\"]+)['\"]", pyproject)
        if m:
            add("python", m.group(1), "pyproject.toml requires-python (range)")
    return pins


def _mise_tools(text):
    tools = {}
    if tomllib is not None:
        try:
            data = tomllib.loads(text)
            for key, value in (data.get("tools") or {}).items():
                if isinstance(value, dict):
                    value = value.get("version")
                elif isinstance(value, list):
                    value = value[0] if value else None
                if value is not None:
                    tools[key] = value
            return tools
        except (ValueError, TypeError):
            pass
    section = None
    for line in text.splitlines():
        stripped = line.split("#")[0].strip()
        m = re.match(r"^\[(.+)\]$", stripped)
        if m:
            section = m.group(1).strip()
            sub = re.match(r'^tools\.(?:"([^"]+)"|([\w:./-]+))$', section)
            section = ("tools", sub.group(1) or sub.group(2)) if sub else section
            continue
        kv = re.match(r'^(?:"([^"]+)"|([\w:./-]+))\s*=\s*(.+)$', stripped)
        if not kv:
            continue
        key = kv.group(1) or kv.group(2)
        value = kv.group(3).strip()
        if section == "tools":
            version = re.search(r'version\s*=\s*"([^"]+)"', value) if value.startswith("{") else re.match(r'^\[?\s*"([^"]+)"', value)
            if version:
                tools[key] = version.group(1)
        elif isinstance(section, tuple) and key == "version":
            m = re.match(r'^"([^"]+)"', value)
            if m:
                tools[section[1]] = m.group(1)
    return tools


def manager(root):
    """The version manager the repo is set up for, and how to run through it."""
    has_mise_cfg = any(os.path.exists(os.path.join(root, f)) for f in ("mise.toml", ".mise.toml", "mise/config.toml", ".config/mise.toml", ".config/mise/config.toml"))
    has_tool_versions = os.path.exists(os.path.join(root, ".tool-versions"))
    if (has_mise_cfg or has_tool_versions) and common.which("mise"):
        return {"name": "mise", "exec_prefix": ["mise", "exec", "--"], "available": True}
    if has_mise_cfg:
        return {"name": "mise", "exec_prefix": [], "available": False}
    if has_tool_versions:
        return {"name": "asdf", "exec_prefix": [], "available": bool(common.which("asdf"))}
    return None
