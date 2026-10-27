"""Machine measurement, the concurrency budget, and the shared slot ledger.

Every check run and every subagent holds a slot in one ledger
(`<main worktree>/.ci-green/budget/slots.json`, guarded by an flock on
`budget/slots.lock`), so agents in any worktree of the repo draw from the same
budget and cannot collectively overload the machine.
"""

import errno
import fcntl
import json
import math
import os
import platform
import re
import shutil
import socket
import time
import uuid

import common

# CPU units and memory (MB) one check of each weight is assumed to need.
CLASS_MEMORY_MB = {"light": 512, "medium": 1536, "heavy": 4096}
AGENT_TTL_SECONDS = 4 * 3600
DEFAULT_RESERVE_CORES = 2
DEFAULT_RESERVE_MEM_PCT = 25


# -- measurement -------------------------------------------------------------
def _sysctl(name):
    code, out, _ = common.run(["sysctl", "-n", name], timeout=5)
    return out.strip() if code == 0 else None


def memory():
    """(total_mb, available_mb)."""
    if os.path.exists("/proc/meminfo"):
        info = {}
        for line in (common.read_text("/proc/meminfo") or "").splitlines():
            parts = line.split()
            if len(parts) >= 2:
                info[parts[0].rstrip(":")] = int(parts[1])
        total = info.get("MemTotal", 0) // 1024
        avail = info.get("MemAvailable", info.get("MemFree", 0)) // 1024
        limit = cgroup_memory_limit_mb()
        if limit and limit < total:
            used = cgroup_memory_used_mb() or 0
            return limit, max(0, min(avail, limit - used))
        return total, avail
    total_bytes = _sysctl("hw.memsize")
    total = int(total_bytes) // (1024 * 1024) if total_bytes else 0
    code, out, _ = common.run(["vm_stat"], timeout=5)
    avail = 0
    if code == 0:
        page = 4096
        m = re.search(r"page size of (\d+) bytes", out)
        if m:
            page = int(m.group(1))
        pages = {}
        for line in out.splitlines():
            m = re.match(r'^"?([^":]+)"?:\s+(\d+)', line)
            if m:
                pages[m.group(1).strip()] = int(m.group(2))
        free = sum(pages.get(k, 0) for k in ("Pages free", "Pages inactive", "Pages speculative", "Pages purgeable"))
        avail = free * page // (1024 * 1024)
    return total, avail


def cgroup_memory_limit_mb():
    for path in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        text = (common.read_text(path) or "").strip()
        if text and text != "max" and text.isdigit():
            value = int(text) // (1024 * 1024)
            if value < 1 << 40:
                return value
    return None


def cgroup_memory_used_mb():
    for path in ("/sys/fs/cgroup/memory.current", "/sys/fs/cgroup/memory/memory.usage_in_bytes"):
        text = (common.read_text(path) or "").strip()
        if text.isdigit():
            return int(text) // (1024 * 1024)
    return None


def cgroup_cpus():
    text = (common.read_text("/sys/fs/cgroup/cpu.max") or "").split()
    if len(text) == 2 and text[0] != "max":
        return float(text[0]) / float(text[1])
    quota = (common.read_text("/sys/fs/cgroup/cpu/cpu.cfs_quota_us") or "").strip()
    period = (common.read_text("/sys/fs/cgroup/cpu/cpu.cfs_period_us") or "").strip()
    if quota and period and quota.lstrip("-").isdigit() and int(quota) > 0:
        return int(quota) / float(period)
    return None


def on_battery():
    """True / False, or None when it cannot be told."""
    if platform.system() == "Darwin":
        code, out, _ = common.run(["pmset", "-g", "batt"], timeout=5)
        if code != 0:
            return None
        if "Battery Power" in out:
            return True
        if "AC Power" in out:
            return False
        return None
    base = "/sys/class/power_supply"
    if not os.path.isdir(base):
        return None
    saw_battery = False
    for name in os.listdir(base):
        kind = (common.read_text(os.path.join(base, name, "type")) or "").strip()
        if kind == "Mains" and (common.read_text(os.path.join(base, name, "online")) or "").strip() == "1":
            return False
        if kind == "Battery":
            saw_battery = True
            if (common.read_text(os.path.join(base, name, "status")) or "").strip() == "Discharging":
                return True
    return False if saw_battery else None


def measure(path):
    cores = os.cpu_count() or 1
    quota = cgroup_cpus() if platform.system() == "Linux" else None
    total_mb, avail_mb = memory()
    try:
        load1, load5, _ = os.getloadavg()
    except OSError:
        load1 = load5 = 0.0
    disk = shutil.disk_usage(path)
    return {
        "os": platform.system().lower(),
        "arch": platform.machine(),
        "logical_cores": cores,
        "cpu_quota": round(quota, 2) if quota else None,
        "memory_total_mb": total_mb,
        "memory_available_mb": avail_mb,
        "disk_free_gb": round(disk.free / 1e9, 1),
        "load_1m": round(load1, 2),
        "load_5m": round(load5, 2),
        "on_battery": on_battery(),
    }


# -- policy ------------------------------------------------------------------
def _env_int(name, default):
    value = os.environ.get(name)
    try:
        return int(value) if value not in (None, "") else default
    except ValueError:
        return default


def compute(machine):
    """The budget for this machine right now (see references/resource-budgeting.md)."""
    cores = machine["logical_cores"]
    if machine.get("cpu_quota"):
        cores = max(1, int(math.floor(machine["cpu_quota"])))
    reserve_cores = _env_int("CI_GREEN_RESERVE_CORES", DEFAULT_RESERVE_CORES)
    reserve_pct = _env_int("CI_GREEN_RESERVE_MEM_PCT", DEFAULT_RESERVE_MEM_PCT)
    cpu_units = max(1, cores - reserve_cores)
    notes = []
    if machine.get("on_battery"):
        cpu_units = max(1, cpu_units // 2)
        notes.append("on battery: CPU budget halved")
    headroom = max(0, int(cores - reserve_cores - machine["load_1m"]))
    if headroom < cpu_units:
        notes.append("load %.1f leaves %d of %d CPU units free right now: parallelism is cut to match, and launches wait while it stays high" % (
            machine["load_1m"], headroom, cpu_units))
    reserve_mb = machine["memory_total_mb"] * reserve_pct // 100
    mem_budget = max(0, machine["memory_available_mb"] - reserve_mb)
    if machine["disk_free_gb"] < 5:
        notes.append("only %.1f GB disk free: builds may fail with ENOSPC; free space before heavy checks" % machine["disk_free_gb"])
    heavy_cpu = max(2, min(cpu_units, int(math.ceil(cpu_units / 2.0))))
    classes = {
        "light": {"cpu": 1, "memory_mb": CLASS_MEMORY_MB["light"]},
        "medium": {"cpu": min(2, cpu_units), "memory_mb": CLASS_MEMORY_MB["medium"]},
        "heavy": {"cpu": min(heavy_cpu, cpu_units), "memory_mb": CLASS_MEMORY_MB["heavy"]},
    }
    max_checks = _env_int("CI_GREEN_MAX_CHECKS", max(1, min(cpu_units, headroom, mem_budget // CLASS_MEMORY_MB["light"])))
    max_agents = _env_int("CI_GREEN_MAX_AGENTS", max(1, min(6, cpu_units // 2 or 1, max_checks)))
    return {
        "reserve": {"cores": reserve_cores, "memory_pct": reserve_pct, "memory_mb": reserve_mb},
        "cpu_units": cpu_units,
        "cpu_headroom_now": headroom,
        "memory_budget_mb": mem_budget,
        "max_parallel_checks": max_checks,
        "max_parallel_heavy": 1,
        "max_parallel_agents": max_agents,
        "classes": classes,
        "nice": _env_int("CI_GREEN_NICE", 10),
        "notes": notes,
    }


def snapshot(root=None):
    root = root or common.repo_root()
    machine = measure(root)
    return machine, compute(machine)


# -- ledger ------------------------------------------------------------------
class Ledger(object):
    """slots.json (check and subagent slots) or services.json, each behind its own flock."""

    def __init__(self, root=None, name="slots"):
        self.dir = common.budget_dir(root)
        self.path = os.path.join(self.dir, name + ".json")
        self.lock_path = os.path.join(self.dir, name + ".lock")
        self.root = root
        self.handle = None

    def __enter__(self):
        self.handle = open(self.lock_path, "a+")
        fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX)
        return self

    def __exit__(self, *exc):
        fcntl.flock(self.handle.fileno(), fcntl.LOCK_UN)
        self.handle.close()
        self.handle = None

    def load(self):
        data = common.read_json(self.path, None) or {}
        data.setdefault("slots", [])
        data.setdefault("services", {})
        return data

    def save(self, data):
        common.write_json(self.path, data)


def pid_alive(pid):
    try:
        os.kill(int(pid), 0)
    except OSError as exc:
        return exc.errno == errno.EPERM
    except (TypeError, ValueError):
        return False
    return True


def reap(data):
    """Drop slots whose owner died or whose lease expired."""
    host = socket.gethostname()
    now = time.time()
    keep, dropped = [], []
    for slot in data["slots"]:
        expired = slot.get("expires_at") and slot["expires_at"] < now
        dead = slot.get("pid") and slot.get("host") == host and not pid_alive(slot["pid"])
        (dropped if expired or dead else keep).append(slot)
    data["slots"] = keep
    return dropped


def held(data, kind=None):
    return [s for s in data["slots"] if kind is None or s["kind"] == kind]


def _blocker(data, request, budget, machine):
    """Why `request` cannot start now, or None."""
    checks = held(data, "check")
    agents = held(data, "agent")
    if request["kind"] == "agent":
        if len(agents) >= budget["max_parallel_agents"]:
            return "%d of %d subagent slots in use" % (len(agents), budget["max_parallel_agents"])
        return None
    same = [s for s in checks if s["id"] == request["id"]]
    if same:
        return "check %s is already running (pid %s)" % (request["id"], same[0].get("pid"))
    if not checks:
        return None  # always let one check run, so the queue cannot stall
    if request["weight"] == "heavy" and any(s["weight"] == "heavy" for s in checks):
        return "a heavy check is already running"
    if len(checks) >= budget["max_parallel_checks"]:
        return "%d of %d check slots in use" % (len(checks), budget["max_parallel_checks"])
    used_cpu = sum(s["cpu"] for s in checks)
    if used_cpu + request["cpu"] > budget["cpu_units"]:
        return "CPU budget: %d of %d units in use" % (used_cpu, budget["cpu_units"])
    cores = machine["logical_cores"]
    usable = max(1, cores - budget["reserve"]["cores"])
    if machine["load_1m"] - used_cpu > usable * 0.75 and machine["load_1m"] > usable:
        return "machine load %.1f is high (usable cores %d)" % (machine["load_1m"], usable)
    reserve = budget["reserve"]["memory_mb"]
    if machine["memory_available_mb"] - reserve < request["memory_mb"]:
        return "memory: %d MB available, %d MB reserved, %d MB needed" % (machine["memory_available_mb"], reserve, request["memory_mb"])
    return None


def acquire(kind, slot_id, weight="medium", wait=None, label=None, pid=None, ttl=None, root=None, log=None):
    """Block until a slot is granted; return the slot dict. wait=0 tries once
    and returns None when refused; wait=None waits indefinitely."""
    root = root or common.repo_root()
    deadline = None if wait is None else time.time() + wait
    delay = 2.0
    last_reason = None
    while True:
        machine = measure(root)
        budget = compute(machine)
        cls = budget["classes"].get(weight, budget["classes"]["medium"])
        request = {
            "token": uuid.uuid4().hex[:12],
            "kind": kind,
            "id": slot_id,
            "label": label or slot_id,
            "weight": weight if kind == "check" else "agent",
            "cpu": cls["cpu"] if kind == "check" else 0,
            "memory_mb": cls["memory_mb"] if kind == "check" else 0,
            "pid": pid if pid is not None else (os.getpid() if kind == "check" else None),
            "host": socket.gethostname(),
            "worktree": root,
            "started_at": time.time(),
            "expires_at": time.time() + (ttl or AGENT_TTL_SECONDS) if kind == "agent" else None,
        }
        with Ledger(root) as ledger:
            data = ledger.load()
            reap(data)
            reason = _blocker(data, request, budget, machine)
            if reason is None:
                data["slots"].append(request)
                ledger.save(data)
                return request
            ledger.save(data)
        if deadline is not None and time.time() >= deadline:
            if log:
                log("budget: not granted (%s)" % reason)
            return None
        if log and reason != last_reason:
            log("budget: waiting (%s)" % reason)
        last_reason = reason
        time.sleep(delay)
        delay = min(15.0, delay * 1.5)


def release(token, root=None):
    with Ledger(root) as ledger:
        data = ledger.load()
        before = len(data["slots"])
        data["slots"] = [s for s in data["slots"] if s["token"] != token]
        ledger.save(data)
        return before != len(data["slots"])


def renew(token, ttl=None, root=None):
    with Ledger(root) as ledger:
        data = ledger.load()
        for slot in data["slots"]:
            if slot["token"] == token:
                slot["expires_at"] = time.time() + (ttl or AGENT_TTL_SECONDS)
                ledger.save(data)
                return True
        return False


def status(root=None):
    with Ledger(root) as ledger:
        data = ledger.load()
        dropped = reap(data)
        ledger.save(data)
    with Ledger(root, "services") as ledger:
        data["services"] = ledger.load()["services"]
    return data, dropped


def to_json(value):
    return json.dumps(value, indent=2, sort_keys=False)
