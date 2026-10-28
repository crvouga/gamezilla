"""Evaluator for `${{ ... }}` expressions (GitHub Actions, and the same
syntax in Azure Pipelines templates), simulating a pull-request run.

Anything that depends on runtime state (job outputs, step results, run ids)
evaluates to UNKNOWN, which propagates, so callers can tell "false" from
"cannot know locally".
"""

import glob
import json
import os
import re


class _Unknown(object):
    def __repr__(self):
        return "<unknown>"

    def __bool__(self):
        raise TypeError("truthiness of UNKNOWN")


UNKNOWN = _Unknown()

_TOKEN = re.compile(
    r"\s*(?:(?P<num>-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)"
    r"|(?P<str>'(?:[^']|'')*')"
    r"|(?P<op>==|!=|<=|>=|&&|\|\||[!<>().,\[\]*])"
    r"|(?P<id>[A-Za-z_][A-Za-z0-9_-]*))"
)


class ExprError(ValueError):
    pass


def _tokens(text):
    pos = 0
    out = []
    text = text.strip()
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m or m.end() == pos:
            raise ExprError("bad token at %r" % text[pos:pos + 20])
        pos = m.end()
        for kind in ("num", "str", "op", "id"):
            if m.group(kind) is not None:
                out.append((kind, m.group(kind)))
                break
    return out


def truthy(value):
    if value is UNKNOWN:
        return UNKNOWN
    if value is None or value is False:
        return False
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value != 0
    if isinstance(value, str):
        return value != ""
    return True


def to_str(value):
    if value is None:
        return ""
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, (dict, list)):
        return json.dumps(value)
    return str(value)


def _coerce_num(value):
    if value is None:
        return 0
    if isinstance(value, bool):
        return 1 if value else 0
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        if value.strip() == "":
            return 0
        try:
            return float(value)
        except ValueError:
            return float("nan")
    return float("nan")


def _compare(op, a, b):
    if a is UNKNOWN or b is UNKNOWN:
        return UNKNOWN
    if isinstance(a, str) and isinstance(b, str):
        a, b = a.lower(), b.lower()
    elif type(a) != type(b) or isinstance(a, bool):
        a, b = _coerce_num(a), _coerce_num(b)
    try:
        return {
            "==": a == b, "!=": a != b, "<": a < b,
            ">": a > b, "<=": a <= b, ">=": a >= b,
        }[op]
    except TypeError:
        return False


class Context(object):
    """Named contexts plus a record of what the expressions referenced."""

    def __init__(self, values, root):
        self.values = values
        self.root = root
        self.secrets = set()
        self.vars = set()
        self.unresolved = set()

    def isolated(self):
        """A child that records references separately (one per job)."""
        ctx = Context(dict(self.values), self.root)
        return ctx

    def child(self, **updates):
        values = dict(self.values)
        values.update(updates)
        ctx = Context(values, self.root)
        ctx.secrets = self.secrets
        ctx.vars = self.vars
        ctx.unresolved = self.unresolved
        return ctx


class _Parser(object):
    def __init__(self, tokens, ctx, text):
        self.t = tokens
        self.i = 0
        self.ctx = ctx
        self.text = text

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def take(self, value=None):
        tok = self.peek()
        if value is not None and tok[1] != value:
            raise ExprError("expected %s in %r" % (value, self.text))
        self.i += 1
        return tok

    def parse(self):
        value = self.or_()
        if self.i != len(self.t):
            raise ExprError("trailing tokens in %r" % self.text)
        return value

    def or_(self):
        left = self.and_()
        while self.peek()[1] == "||":
            self.take()
            right = self.and_()
            t = truthy(left)
            if t is UNKNOWN:
                left = UNKNOWN
            elif not t:
                left = right
        return left

    def and_(self):
        left = self.cmp_()
        while self.peek()[1] == "&&":
            self.take()
            right = self.cmp_()
            t = truthy(left)
            if t is UNKNOWN:
                left = right if truthy(right) is False else UNKNOWN
            elif t:
                left = right
        return left

    def cmp_(self):
        left = self.unary()
        while self.peek()[1] in ("==", "!=", "<", ">", "<=", ">="):
            op = self.take()[1]
            left = _compare(op, left, self.unary())
        return left

    def unary(self):
        if self.peek()[1] == "!":
            self.take()
            t = truthy(self.unary())
            return UNKNOWN if t is UNKNOWN else (not t)
        return self.postfix()

    def postfix(self):
        kind, tok = self.take()
        path = None
        if kind == "num":
            value = float(tok) if any(c in tok for c in ".eE") else int(tok)
        elif kind == "str":
            value = tok[1:-1].replace("''", "'")
        elif tok == "(":
            value = self.or_()
            self.take(")")
        elif kind == "id":
            low = tok.lower()
            if low in ("true", "false"):
                value = low == "true"
            elif low == "null":
                value = None
            elif self.peek()[1] == "(":
                return self.postfix_tail(self.call(low), None)
            else:
                path = [low]
                value = self.lookup_root(low)
        else:
            raise ExprError("unexpected %r in %r" % (tok, self.text))
        return self.postfix_tail(value, path)

    def postfix_tail(self, value, path):
        while self.peek()[1] in (".", "["):
            if self.take()[1] == ".":
                kind, name = self.take()
                key = name
            else:
                key = self.or_()
                self.take("]")
            if path is not None:
                path.append(str(key))
            value = self.member(value, key, path)
        if value is UNKNOWN and path and path[0] not in ("secrets",):
            self.ctx.unresolved.add(".".join(path))
        return value

    def lookup_root(self, name):
        if name not in self.ctx.values:
            return UNKNOWN
        return self.ctx.values[name]

    def member(self, value, key, path):
        root = path[0] if path else None
        if root == "secrets" and len(path) == 2:
            self.ctx.secrets.add(path[1].upper())
            env_value = os.environ.get(path[1].upper())
            return env_value if env_value is not None else UNKNOWN
        if root == "vars" and len(path) == 2:
            # Repository variables are not visible locally; treat them as
            # unset and record the assumption for the manifest.
            self.ctx.vars.add(path[1].upper())
            return None
        if value is UNKNOWN or key is UNKNOWN:
            return UNKNOWN
        if key == "*":
            if isinstance(value, dict):
                return list(value.values())
            return value if isinstance(value, list) else None
        if isinstance(value, dict):
            low = str(key).lower()
            for k, v in value.items():
                if str(k).lower() == low:
                    return v
            return None
        if isinstance(value, list):
            try:
                return value[int(_coerce_num(key))]
            except (IndexError, ValueError):
                return None
        return None

    def call(self, name):
        self.take("(")
        args = []
        if self.peek()[1] != ")":
            args.append(self.or_())
            while self.peek()[1] == ",":
                self.take()
                args.append(self.or_())
        self.take(")")
        return self.function(name, args)

    def function(self, name, args):
        if name in ("success", "always"):
            return True
        if name in ("failure", "cancelled"):
            return False
        if any(a is UNKNOWN for a in args):
            return UNKNOWN
        if name == "contains":
            hay, needle = args[0], args[1]
            if isinstance(hay, list):
                return any(to_str(x).lower() == to_str(needle).lower() for x in hay)
            return to_str(needle).lower() in to_str(hay).lower()
        if name == "startswith":
            return to_str(args[0]).lower().startswith(to_str(args[1]).lower())
        if name == "endswith":
            return to_str(args[0]).lower().endswith(to_str(args[1]).lower())
        if name == "format":
            out = to_str(args[0])
            for idx, arg in enumerate(args[1:]):
                out = out.replace("{%d}" % idx, to_str(arg))
            return out.replace("{{", "{").replace("}}", "}")
        if name == "join":
            sep = to_str(args[1]) if len(args) > 1 else ","
            if isinstance(args[0], list):
                return sep.join(to_str(x) for x in args[0])
            return to_str(args[0])
        if name == "tojson":
            return json.dumps(args[0], indent=2)
        if name == "fromjson":
            try:
                return json.loads(to_str(args[0]))
            except ValueError:
                return UNKNOWN
        if name == "hashfiles":
            root = self.ctx.root
            for pattern in args:
                if glob.glob(os.path.join(root, to_str(pattern)), recursive=True):
                    return "local-hash"
            return ""
        return UNKNOWN


def evaluate(expr, ctx):
    """Value of a bare expression (no `${{ }}`), or UNKNOWN."""
    try:
        return _Parser(_tokens(expr), ctx, expr).parse()
    except (ExprError, IndexError, TypeError):
        ctx.unresolved.add(expr.strip())
        return UNKNOWN


_TEMPLATE = re.compile(r"\$\{\{(.*?)\}\}", re.S)


def substitute(value, ctx):
    """Replace every `${{ }}` the context can answer; leave the rest."""
    if isinstance(value, dict):
        return {k: substitute(v, ctx) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute(v, ctx) for v in value]
    if not isinstance(value, str) or "${{" not in value:
        return value
    whole = _TEMPLATE.fullmatch(value.strip())
    if whole:
        result = evaluate(whole.group(1), ctx)
        return value if result is UNKNOWN else result

    def repl(m):
        result = evaluate(m.group(1), ctx)
        return m.group(0) if result is UNKNOWN else to_str(result)

    return _TEMPLATE.sub(repl, value)


def has_template(value):
    if isinstance(value, dict):
        return any(has_template(v) for v in value.values())
    if isinstance(value, list):
        return any(has_template(v) for v in value)
    return isinstance(value, str) and "${{" in value


def condition(raw, ctx):
    """True / False / UNKNOWN for an `if:` (with or without `${{ }}`)."""
    if raw is None:
        return True
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip()
    m = _TEMPLATE.fullmatch(text)
    if m:
        text = m.group(1)
    elif "${{" in text:
        text = _TEMPLATE.sub(lambda mm: to_str(evaluate(mm.group(1), ctx)), text)
        return truthy(text)
    return truthy(evaluate(text, ctx))
