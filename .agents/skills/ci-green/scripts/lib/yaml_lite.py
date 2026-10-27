"""A YAML subset parser, Python 3 stdlib only.

Covers what CI configuration files use: block mappings and sequences, flow
collections, plain / quoted / multi-line scalars, literal and folded block
scalars, comments, anchors, aliases, merge keys (`<<`) and tags (`!reference`
is kept as {"!reference": [...]}; other tags are dropped). Keys are always
strings, so GitHub's `on:` stays "on". Only the first document is read.

Not supported: complex keys (`? `), multiple documents, directives.
"""

import json
import re

__all__ = ["load", "loads", "YamlError"]


class YamlError(ValueError):
    pass


_INT = re.compile(r"^[-+]?(0|[1-9][0-9_]*)$")
_FLOAT = re.compile(r"^[-+]?(\.[0-9]+|[0-9][0-9_]*(\.[0-9]*)?)([eE][-+]?[0-9]+)?$")
_ANCHOR = re.compile(r"^&([^\s,\[\]{}]+)\s*")
_ALIAS = re.compile(r"^\*([^\s,\[\]{}]+)\s*$")
_TAG = re.compile(r"^(![^\s]*)\s*")
_BLOCK_HEADER = re.compile(r"^([|>])([-+]?)([1-9]?)([-+]?)\s*(#.*)?$")


def load(path):
    with open(path, encoding="utf-8") as handle:
        return loads(handle.read())


def loads(text):
    if text.lstrip()[:1] in ("{", "["):
        try:
            return json.loads(text)
        except ValueError:
            pass
    return _Parser(text).parse()


def _indent(line):
    return len(line) - len(line.lstrip(" "))


def _skip_expression(s, i):
    """Index after a `${{ ... }}` starting at i, else i."""
    if s.startswith("${{", i):
        end = s.find("}}", i + 3)
        if end != -1:
            return end + 2
    return i


def _strip_comment(s):
    out_end = len(s)
    quote = None
    i = 0
    while i < len(s):
        c = s[i]
        if quote:
            if quote == "'" and c == "'":
                if s.startswith("''", i):
                    i += 2
                    continue
                quote = None
            elif quote == '"' and c == "\\":
                i += 2
                continue
            elif quote == '"' and c == '"':
                quote = None
        else:
            j = _skip_expression(s, i)
            if j != i:
                i = j
                continue
            if c in "\"'" and (i == 0 or s[i - 1] in " \t[{,:-?"):
                quote = c
            elif c == "#" and (i == 0 or s[i - 1] in " \t"):
                out_end = i
                break
        i += 1
    return s[:out_end].rstrip()


def _map_colon(s):
    """Index of the `:` that makes s a `key: value` entry, else None."""
    if not s or s[0] in "[{" or s.startswith("- ") or s == "-":
        return None
    i = 0
    if s[0] in "\"'":
        quote = s[0]
        i = 1
        while i < len(s):
            if quote == "'" and s[i] == "'":
                if s.startswith("''", i):
                    i += 2
                    continue
                break
            if quote == '"' and s[i] == "\\":
                i += 2
                continue
            if quote == '"' and s[i] == '"':
                break
            i += 1
        i += 1
        rest = s[i:].lstrip()
        if rest.startswith(":") and (len(rest) == 1 or rest[1] in " \t"):
            return len(s) - len(rest)
        return None
    while i < len(s):
        j = _skip_expression(s, i)
        if j != i:
            i = j
            continue
        if s[i] == ":" and (i + 1 == len(s) or s[i + 1] in " \t"):
            return i
        if s[i] == "#" and i > 0 and s[i - 1] in " \t":
            return None
        i += 1
    return None


def _unquote_single(body):
    return body.replace("''", "'")


_ESCAPES = {
    "n": "\n", "t": "\t", "r": "\r", "0": "\0", "\\": "\\", '"': '"',
    "/": "/", " ": " ", "a": "\a", "b": "\b", "e": "\x1b", "f": "\f",
    "v": "\v", "N": "\x85", "_": "\xa0",
}


def _unquote_double(body):
    out = []
    i = 0
    while i < len(body):
        c = body[i]
        if c == "\\" and i + 1 < len(body):
            n = body[i + 1]
            if n in _ESCAPES:
                out.append(_ESCAPES[n])
                i += 2
                continue
            width = {"x": 2, "u": 4, "U": 8}.get(n)
            if width:
                try:
                    out.append(chr(int(body[i + 2:i + 2 + width], 16)))
                    i += 2 + width
                    continue
                except ValueError:
                    pass
            out.append(n)
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def _fold_lines(lines):
    """YAML line folding for multi-line flow scalars."""
    if len(lines) == 1:
        return lines[0]
    out = ""
    pending_breaks = 0
    last = len(lines) - 1
    for idx, raw in enumerate(lines):
        line = raw.lstrip() if idx else raw
        if idx != last:
            line = line.rstrip()
        if idx and not line:
            pending_breaks += 1
            continue
        if idx:
            out += "\n" * pending_breaks if pending_breaks else " "
        pending_breaks = 0
        out += line
    return out


def plain_scalar(s):
    s = s.strip()
    if s in ("", "~", "null", "Null", "NULL"):
        return None
    if s in ("true", "True", "TRUE"):
        return True
    if s in ("false", "False", "FALSE"):
        return False
    if _INT.match(s):
        try:
            return int(s.replace("_", ""))
        except ValueError:
            return s
    if _FLOAT.match(s) and any(ch.isdigit() for ch in s):
        try:
            return float(s.replace("_", ""))
        except ValueError:
            return s
    return s


class _Flow:
    """Parser for flow collections and inline scalars: [a, {b: c}], "x"."""

    def __init__(self, text, anchors):
        self.s = text
        self.i = 0
        self.anchors = anchors

    def ws(self):
        while self.i < len(self.s) and self.s[self.i] in " \t\r\n":
            self.i += 1

    def value(self, stops):
        self.ws()
        if self.i >= len(self.s):
            return None
        anchor = None
        m = _ANCHOR.match(self.s[self.i:])
        if m:
            anchor = m.group(1)
            self.i += m.end()
        m = _TAG.match(self.s[self.i:])
        tag = None
        if m and self.s[self.i] == "!":
            tag = m.group(1)
            self.i += m.end()
        c = self.s[self.i] if self.i < len(self.s) else ""
        if c == "[":
            val = self.seq()
        elif c == "{":
            val = self.mapping()
        elif c in "\"'":
            val = self.quoted()
        elif c == "*":
            j = self.i + 1
            while j < len(self.s) and self.s[j] not in stops and self.s[j] not in " \t":
                j += 1
            name = self.s[self.i + 1:j]
            self.i = j
            if name not in self.anchors:
                raise YamlError("unknown alias *%s" % name)
            val = self.anchors[name]
        else:
            val = plain_scalar(self.plain(stops))
        if tag == "!reference":
            val = {"!reference": val}
        if anchor:
            self.anchors[anchor] = val
        return val

    def plain(self, stops):
        start = self.i
        while self.i < len(self.s):
            j = _skip_expression(self.s, self.i)
            if j != self.i:
                self.i = j
                continue
            c = self.s[self.i]
            if c in stops:
                break
            if c == ":" and ":" in stops and (
                self.i + 1 == len(self.s) or self.s[self.i + 1] in " \t,]}"
            ):
                break
            if c == "#" and self.i > start and self.s[self.i - 1] in " \t":
                break
            self.i += 1
        return self.s[start:self.i].strip()

    def quoted(self):
        quote = self.s[self.i]
        j = self.i + 1
        while j < len(self.s):
            if quote == "'" and self.s[j] == "'":
                if self.s.startswith("''", j):
                    j += 2
                    continue
                break
            if quote == '"' and self.s[j] == "\\":
                j += 2
                continue
            if quote == '"' and self.s[j] == '"':
                break
            j += 1
        if j >= len(self.s):
            raise YamlError("unterminated quoted scalar")
        body = _fold_lines(self.s[self.i + 1:j].split("\n"))
        self.i = j + 1
        return _unquote_single(body) if quote == "'" else _unquote_double(body)

    def seq(self):
        self.i += 1
        out = []
        while True:
            self.ws()
            if self.i >= len(self.s):
                raise YamlError("unterminated flow sequence")
            if self.s[self.i] == "]":
                self.i += 1
                return out
            before = self.i
            item = self.value(",]:")
            self.ws()
            if self.i < len(self.s) and self.s[self.i] == ":":
                self.i += 1
                item = {_key(item): self.value(",]")}
                self.ws()
            out.append(item)
            if self.i < len(self.s) and self.s[self.i] == ",":
                self.i += 1
            elif self.i == before or (self.i < len(self.s) and self.s[self.i] != "]"):
                raise YamlError("malformed flow sequence")

    def mapping(self):
        self.i += 1
        out = {}
        while True:
            self.ws()
            if self.i >= len(self.s):
                raise YamlError("unterminated flow mapping")
            if self.s[self.i] == "}":
                self.i += 1
                return out
            before = self.i
            key = self.value(",}:")
            self.ws()
            val = None
            if self.i < len(self.s) and self.s[self.i] == ":":
                self.i += 1
                val = self.value(",}")
                self.ws()
            if key == "<<":
                _merge_into(out, val, set(out))
            else:
                out[_key(key)] = val
            if self.i < len(self.s) and self.s[self.i] == ",":
                self.i += 1
            elif self.i == before or (self.i < len(self.s) and self.s[self.i] != "}"):
                raise YamlError("malformed flow mapping")


def _key(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _merge_into(target, merged, explicit):
    sources = merged if isinstance(merged, list) else [merged]
    for source in sources:
        if not isinstance(source, dict):
            continue
        for k, v in source.items():
            if k not in explicit and k not in target:
                target[k] = v


class _Balance:
    """Incremental bracket/quote tracker for flow text spanning lines."""

    def __init__(self):
        self.depth = 0
        self.quote = None
        self.prev = "\n"

    def feed(self, s):
        i = 0
        while i < len(s):
            c = s[i]
            if self.quote:
                if (self.quote == '"' and c == "\\") or (
                    self.quote == "'" and s.startswith("''", i)
                ):
                    i += 2
                    self.prev = ""
                    continue
                if c == self.quote:
                    self.quote = None
            else:
                j = _skip_expression(s, i)
                if j != i:
                    i = j
                    self.prev = "}"
                    continue
                if c in "\"'" and self.prev in " \t\n[{,:":
                    self.quote = c
                elif c in "[{":
                    self.depth += 1
                elif c in "]}":
                    self.depth -= 1
            self.prev = c
            i += 1
        self.prev = "\n"
        return self.depth <= 0 and self.quote is None


class _Parser:
    def __init__(self, text):
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        if text.startswith("﻿"):
            text = text[1:]
        lines = text.split("\n")
        start = 0
        while start < len(lines) and (
            not lines[start].strip()
            or lines[start].lstrip().startswith("#")
            or lines[start].startswith("%")
        ):
            start += 1
        body = []
        for idx, line in enumerate(lines[start:]):
            if line.startswith("---") and (len(line) == 3 or line[3] in " \t"):
                if idx == 0:
                    rest = line[3:].strip()
                    body.append(rest if rest and not rest.startswith("#") else "")
                    continue
                break
            if line.rstrip() == "...":
                break
            body.append(line)
        self.lines = body
        self.i = 0
        self.anchors = {}

    # -- line navigation -------------------------------------------------
    def peek(self):
        """(index, indent, content-without-comment) of the next content line."""
        j = self.i
        while j < len(self.lines):
            raw = self.lines[j]
            stripped = raw.strip()
            if stripped and not stripped.startswith("#"):
                return j, _indent(raw), _strip_comment(raw.strip())
            j += 1
        return None

    def error(self, msg, idx=None):
        line = (idx if idx is not None else self.i) + 1
        return YamlError("line %d: %s" % (line, msg))

    # -- entry -----------------------------------------------------------
    def parse(self):
        nxt = self.peek()
        if nxt is None:
            return None
        j, ind, _ = nxt
        self.i = j
        return self.block(ind)

    def block(self, indent):
        nxt = self.peek()
        if nxt is None:
            return None
        j, ind, content = nxt
        self.i = j
        if content == "-" or content.startswith("- "):
            return self.seq(ind)
        if _map_colon(content) is not None:
            return self.mapping(ind)
        return self.scalar_lines(content, ind - 1)

    # -- node values -----------------------------------------------------
    def value_after(self, rest, parent_indent, allow_same_indent_seq):
        """Parse the value that follows `key:` or `- ` on the current line."""
        anchor = None
        tag = None
        while True:
            m = _ANCHOR.match(rest)
            if m:
                anchor = m.group(1)
                rest = rest[m.end():]
                continue
            if rest.startswith("!") and not rest.startswith("!="):
                m = _TAG.match(rest)
                tag = m.group(1)
                rest = rest[m.end():]
                continue
            break
        self.i += 1
        if not rest:
            nxt = self.peek()
            val = None
            if nxt is not None:
                j, ind, content = nxt
                is_seq = content == "-" or content.startswith("- ")
                if ind > parent_indent or (
                    allow_same_indent_seq and ind == parent_indent and is_seq
                ):
                    self.i = j
                    val = self.block(ind)
        else:
            m = _ALIAS.match(rest)
            if m:
                if m.group(1) not in self.anchors:
                    raise self.error("unknown alias *%s" % m.group(1), self.i - 1)
                val = self.anchors[m.group(1)]
            elif _BLOCK_HEADER.match(rest):
                val = self.block_scalar(rest, parent_indent)
            else:
                self.i -= 1
                val = self.scalar_lines(rest, parent_indent)
        if tag == "!reference":
            val = {"!reference": val}
        if anchor:
            self.anchors[anchor] = val
        return val

    def scalar_lines(self, first, parent_indent):
        """A flow collection, quoted or plain scalar starting on line self.i."""
        start = self.i
        self.i += 1
        if first[0] in "[{":
            balance = _Balance()
            chunks = [first]
            done = balance.feed(first)
            while not done and self.i < len(self.lines):
                chunk = _strip_comment(self.lines[self.i])
                chunks.append(chunk)
                done = balance.feed(chunk)
                self.i += 1
            return _Flow("\n".join(chunks), self.anchors).value(",")
        if first[0] in "\"'":
            balance = _Balance()
            chunks = [first]
            done = balance.feed(first)
            while not done and self.i < len(self.lines):
                chunks.append(self.lines[self.i])
                done = balance.feed(self.lines[self.i])
                self.i += 1
            if not done:
                raise self.error("unterminated quoted scalar", start)
            return _Flow("\n".join(chunks), self.anchors).value(",")
        parts = [first]
        while self.i < len(self.lines):
            raw = self.lines[self.i]
            stripped = raw.strip()
            if not stripped:
                parts.append("")
                self.i += 1
                continue
            if stripped.startswith("#") or _indent(raw) <= parent_indent:
                break
            parts.append(_strip_comment(stripped))
            self.i += 1
        while parts and parts[-1] == "":
            parts.pop()
        if len(parts) == 1:
            return plain_scalar(parts[0])
        return _fold_lines(parts)

    def block_scalar(self, header, parent_indent):
        m = _BLOCK_HEADER.match(header)
        style = m.group(1)
        chomp = m.group(2) or m.group(4)
        explicit = int(m.group(3)) if m.group(3) else None
        content_indent = None
        if explicit is not None:
            content_indent = parent_indent + explicit if parent_indent >= 0 else explicit
        lines = []
        while self.i < len(self.lines):
            raw = self.lines[self.i]
            if not raw.strip():
                keep = content_indent is not None and len(raw) > content_indent
                lines.append(raw[content_indent:] if keep else "")
                self.i += 1
                continue
            ind = _indent(raw)
            if content_indent is None:
                if ind <= parent_indent:
                    break
                content_indent = ind
            if ind < content_indent:
                break
            lines.append(raw[content_indent:])
            self.i += 1
        trailing = 0
        while lines and not lines[-1].strip():
            lines.pop()
            trailing += 1
        if style == "|":
            body = "\n".join(lines)
        else:
            parts = []
            for idx, line in enumerate(lines):
                prev = lines[idx - 1] if idx else None
                if prev is None:
                    parts.append(line)
                elif line == "":
                    parts.append("\n")
                elif prev == "":
                    parts.append(line)
                elif line[:1] in " \t" or prev[:1] in " \t":
                    parts.append("\n" + line)
                else:
                    parts.append(" " + line)
            body = "".join(parts)
        if not lines:
            return ""
        if chomp == "-":
            return body
        if chomp == "+":
            return body + "\n" * (trailing + 1)
        return body + "\n"

    # -- collections -----------------------------------------------------
    def mapping(self, indent):
        out = {}
        explicit = set()
        merges = []
        while True:
            nxt = self.peek()
            if nxt is None:
                break
            j, ind, content = nxt
            if ind != indent:
                if ind > indent:
                    raise self.error("unexpected indentation", j)
                break
            if content == "-" or content.startswith("- "):
                break
            colon = _map_colon(content)
            if colon is None:
                raise self.error("expected 'key: value', got %r" % content, j)
            self.i = j
            raw_key = content[:colon].strip()
            if raw_key[:1] in "\"'":
                key = _Flow(raw_key, self.anchors).value(",")
                key = _key(key)
            else:
                key = raw_key
            rest = content[colon + 1:].strip()
            val = self.value_after(rest, indent, True)
            if key == "<<":
                merges.append(val)
                continue
            out[key] = val
            explicit.add(key)
        for merged in merges:
            _merge_into(out, merged, explicit)
        return out

    def seq(self, indent):
        out = []
        while True:
            nxt = self.peek()
            if nxt is None:
                break
            j, ind, content = nxt
            if ind != indent or not (content == "-" or content.startswith("- ")):
                if ind > indent:
                    raise self.error("unexpected indentation", j)
                break
            self.i = j
            raw = self.lines[j]
            after = raw[ind + 1:]
            rest_raw = after.lstrip(" ")
            col = ind + 1 + (len(after) - len(rest_raw))
            rest = _strip_comment(rest_raw)
            anchor = None
            m = _ANCHOR.match(rest)
            if m and rest[m.end():].strip():
                anchor = m.group(1)
                rest = rest[m.end():]
                col += m.end()
                rest_raw = rest_raw[m.end():]
            if rest and (
                rest == "-"
                or rest.startswith("- ")
                or (_map_colon(rest) is not None and rest[0] not in "[{")
            ):
                # Re-read the item as a nested block starting at its column.
                self.lines[j] = " " * col + rest_raw
                val = self.block(col)
            else:
                val = self.value_after(rest, ind, False)
            if anchor:
                self.anchors[anchor] = val
            out.append(val)
        return out
