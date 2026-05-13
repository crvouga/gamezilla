#!/usr/bin/env python3
"""Wrap `attributes: { ... }` with `toAttributeState({ ... })` in patch-db sources."""

from __future__ import annotations

import re
from pathlib import Path


def find_matching_brace(s: str, open_idx: int) -> int:
    depth = 0
    i = open_idx
    in_str: str | None = None
    while i < len(s):
        c = s[i]
        if in_str:
            if c == "\\" and in_str != "`":
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            in_str = c
            i += 1
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unbalanced brace")


def wrap_attributes(text: str) -> str:
    needle = "attributes: {"
    out: list[str] = []
    pos = 0
    while True:
        idx = text.find(needle, pos)
        if idx == -1:
            out.append(text[pos:])
            break
        # already wrapped
        before = text[max(0, idx - 20) : idx]
        if before.rstrip().endswith("toAttributeState("):
            out.append(text[pos : idx + len(needle)])
            pos = idx + len(needle)
            continue
        out.append(text[pos:idx])
        open_brace = idx + len(needle) - 1
        close_idx = find_matching_brace(text, open_brace)
        out.append("attributes: toAttributeState(")
        out.append(text[open_brace : close_idx + 1])
        out.append(")")
        pos = close_idx + 1
    return "".join(out)


def interface_import_path(src_file: Path, patch_db_src: Path) -> str:
    rel = src_file.relative_to(patch_db_src)
    depth = len(rel.parts) - 1
    return ("../" * depth) + "interface"


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "packages" / "patch-db" / "src"
    for path in sorted(root.rglob("*.ts")):
        text = path.read_text()
        if "attributes: {" not in text:
            continue
        new_text = wrap_attributes(text)
        if new_text == text:
            continue
        if "toAttributeState(" not in new_text:
            continue
        imp = interface_import_path(path, root)
        import_stmt = f"import {{ toAttributeState }} from '{imp}';\n"
        # Skip adding duplicate import of toAttributeState from same module
        if re.search(
            rf"import\s+{{[^}}]*\btoAttributeState\b[^}}]*}}\s+from\s+['\"]{re.escape(imp)}['\"]",
            new_text,
        ):
            path.write_text(new_text)
            continue
        lines = new_text.splitlines(keepends=True)
        insert_at = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i + 1
        lines.insert(insert_at, import_stmt)
        path.write_text("".join(lines))


if __name__ == "__main__":
    main()
