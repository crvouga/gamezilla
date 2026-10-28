"""Failure signatures: pull the lines that explain a failure out of a log,
normalise them, and say which file and which kind of problem they point at.
The patterns per ecosystem are documented in references/failure-triage.md."""

import re

ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07")

# (kind, regex). Named groups: file, line, code, msg, module, test.
PATTERNS = [
    # environment and infrastructure first: they explain everything after them
    ("environment", re.compile(r"(?P<msg>(?:mise|asdf|pyenv|rbenv|nodenv|goenv|volta|nvm|fnm|rustup)\b.{0,20}(?:ERROR|error|No version|not installed|not found|is not a valid)[^\n]*)")),
    ("environment", re.compile(r"(?P<msg>(?:unrecognized option|unrecognised option|invalid option|illegal option|Unknown argument|unexpected argument|unknown flag)[^\n]*)", re.I)),
    ("environment", re.compile(r"(?P<msg>(?:command not found|No such file or directory: '?(?P<file>[^'\s]+)'?|: not found$|ENOENT[^\n]*|Cannot find module '(?P<module>[^']+)'|ModuleNotFoundError: No module named '(?P<module2>[^']+)'|error while loading shared libraries[^\n]*|GLIBC_[0-9.]+' not found|no such option|unknown option|Unsupported engine|requires (?:node|python|go|ruby)[^\n]*|The engine \"\w+\" is incompatible[^\n]*|version `[^`]+` not found))")),
    ("service", re.compile(r"(?P<msg>(?:ECONNREFUSED[^\n]*|Connection refused[^\n]*|could not connect to server[^\n]*|connect: connection refused|Is the docker daemon running\?|Cannot connect to the Docker daemon[^\n]*|EADDRINUSE[^\n]*|address already in use))", re.I)),
    ("resources", re.compile(r"(?P<msg>(?:JavaScript heap out of memory|out of memory|OOMKilled|Killed\s*$|signal: killed|exit code 137|No space left on device|ENOSPC[^\n]*|Too many open files|EMFILE[^\n]*))", re.I)),
    ("timeout", re.compile(r"(?P<msg>(?:Exceeded timeout of \d+ ?ms[^\n]*|timed out after [^\n]+|Timeout - Async callback[^\n]*|context deadline exceeded|TimeoutError[^\n]*|test timed out[^\n]*|panic: test timed out[^\n]*))", re.I)),
    # TypeScript
    ("type", re.compile(r"(?P<file>[\w./@+-]+\.(?:ts|tsx|mts|cts|vue|svelte))[(:](?P<line>\d+)[,:](?P<col>\d+)\)?:? - ?error (?P<code>TS\d+): (?P<msg>.+)")),
    ("type", re.compile(r"(?P<file>[\w./@+-]+\.(?:ts|tsx|mts|cts))\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+): (?P<msg>.+)")),
    # Python
    ("type", re.compile(r"(?P<file>[\w./-]+\.pyi?):(?P<line>\d+):(?:\d+:)? error: (?P<msg>.+?)(?:\s+\[(?P<code>[\w-]+)\])?$")),
    ("lint", re.compile(r"(?P<file>[\w./-]+\.pyi?):(?P<line>\d+):(?P<col>\d+): (?P<code>[A-Z]{1,4}\d{2,4}) (?P<msg>.+)")),
    ("test", re.compile(r"^(?:FAILED|ERROR) (?P<file>[\w./-]+\.py)::(?P<test>[\w\[\]:.-]+)(?: - (?P<msg>.+))?")),
    ("error", re.compile(r"^(?P<code>[A-Z]\w*(?:Error|Exception)): (?P<msg>.+)")),
    # Go
    ("test", re.compile(r"^--- FAIL: (?P<test>\S+)")),
    ("build", re.compile(r"^(?P<file>[\w./-]+\.go):(?P<line>\d+):(?P<col>\d+): (?P<msg>.+)")),
    ("error", re.compile(r"^panic: (?P<msg>.+)")),
    # Rust
    ("build", re.compile(r"^error(?:\[(?P<code>E\d{4})\])?: (?P<msg>.+)")),
    ("lint", re.compile(r"^(?:error|warning): (?P<msg>.+)\s+\(?#?\[?(?P<code>clippy::[\w_]+)")),
    ("test", re.compile(r"^test (?P<test>[\w:]+) \.\.\. FAILED")),
    # JavaScript test runners
    ("test", re.compile(r"^\s*(?:●|✕|×|✗|\(fail\))\s+(?P<test>.+?)(?:\s+\[\d+(?:\.\d+)?m?s\])?$")),
    ("test", re.compile(r"^\s*FAIL\s+(?P<file>[\w./@-]+\.(?:[cm]?[jt]sx?))(?:\s+>\s+(?P<test>.+))?")),
    ("lint", re.compile(r"^\s*(?P<line>\d+):(?P<col>\d+)\s+error\s+(?P<msg>.+?)\s{2,}(?P<code>[@\w/-]+)$")),
    ("lint", re.compile(r"^(?P<file>[\w./@-]+\.\w+):(?P<line>\d+):(?P<col>\d+)\s+(?P<code>lint/[\w/]+|assist/[\w/]+|format|plugin)\b(?P<msg>.*)")),
    ("format", re.compile(r"(?P<msg>(?:Code style issues found|would reformat|Formatter would have printed|The following files are not formatted|files? (?:were|was) not formatted|needs formatting|Diff in (?P<file>\S+)))", re.I)),
    # JVM / Maven / Gradle
    ("build", re.compile(r"^\[ERROR\] (?P<file>[\w./-]+\.(?:java|kt|scala)):\[(?P<line>\d+),(?P<col>\d+)\] (?P<msg>.+)")),
    ("test", re.compile(r"^\[ERROR\] (?P<test>[\w.$]+)(?::\d+)? .*(?:FAILURE|ERROR)")),
    ("build", re.compile(r"^e: (?:file://)?(?P<file>[\w./-]+\.kts?):(?P<line>\d+):(?P<col>\d+) (?P<msg>.+)")),
    # Ruby, Swift, C/C++, shell
    ("test", re.compile(r"^rspec (?P<file>\./[\w./-]+_spec\.rb):(?P<line>\d+)")),
    ("build", re.compile(r"^(?P<file>[\w./-]+\.(?:swift|c|cc|cpp|h|hpp|m|mm)):(?P<line>\d+):(?P<col>\d+): (?:fatal )?error: (?P<msg>.+)")),
    ("lint", re.compile(r"^In (?P<file>[\w./-]+) line (?P<line>\d+):")),
    # generic
    ("error", re.compile(r"(?:^|\s)(?:error|Error|ERROR)(?:\[[\w-]+\])?:\s+(?P<msg>.{8,})")),
    ("error", re.compile(r"\bERROR\b:?\s+(?P<msg>[A-Za-z].{8,})")),
    ("error", re.compile(r"(?P<msg>(?:npm ERR!|npm error|ERR_PNPM_\w+|error Command failed|Process completed with exit code \d+|make: \*\*\*|exit status [1-9]\d*)[^\n]*)")),
]

NOISE = re.compile(r"^\s*(?:at |\d+ \||\^+|~+|>\s|\|\s|Traceback|During handling)")


def strip_ansi(text):
    return ANSI.sub("", text)


def normalise(msg):
    """Make a message comparable across runs and files."""
    msg = strip_ansi(msg or "").strip()
    msg = re.sub(r"0x[0-9a-fA-F]+", "0x?", msg)
    msg = re.sub(r"\b[0-9a-f]{8,}\b", "<hash>", msg)
    msg = re.sub(r"(/[\w.@+-]+){2,}/?", "<path>", msg)
    msg = re.sub(r"\b\d+(\.\d+)?\s*(ms|s|sec|seconds|MB|KB|GB|bytes)\b", "<n><unit>", msg)
    msg = re.sub(r"\b\d+\b", "<n>", msg)
    msg = re.sub(r"'[^']{1,80}'|\"[^\"]{1,80}\"|`[^`]{1,80}`", "<q>", msg)
    return re.sub(r"\s+", " ", msg)[:200]


def extract(text, limit=40):
    """Signature dicts for the lines in text that explain a failure."""
    out = []
    seen = set()
    for raw in strip_ansi(text).splitlines():
        line = raw.rstrip()
        if not line or NOISE.match(line) or len(line) > 2000:
            continue
        for kind, pattern in PATTERNS:
            m = pattern.search(line)
            if not m:
                continue
            groups = m.groupdict()
            module = groups.get("module") or groups.get("module2")
            msg = groups.get("msg") or groups.get("test") or line.strip()
            sig = {
                "kind": kind,
                "file": groups.get("file"),
                "line": int(groups["line"]) if groups.get("line") else None,
                "code": groups.get("code"),
                "test": groups.get("test"),
                "module": module,
                "text": line.strip()[:300],
            }
            key = (kind, sig["code"] or "", normalise(msg), sig["file"] or "")
            sig["key"] = "%s|%s|%s" % (kind, sig["code"] or "", normalise(msg))
            if key not in seen:
                seen.add(key)
                out.append(sig)
            break
        if len(out) >= limit:
            break
    return out


def tail(text, lines=60):
    return "\n".join(strip_ansi(text).splitlines()[-lines:])
