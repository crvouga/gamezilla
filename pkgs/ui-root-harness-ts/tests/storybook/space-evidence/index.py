"""Index one downloaded hosted run against the checked-in capture scope."""

import hashlib
import json
import struct
import sys
from pathlib import Path

root = Path(sys.argv[1])
sha = sys.argv[2]
scope = json.loads(Path(__file__).with_name("scope.json").read_text())
groups = {story: group for group, stories in scope["boards"].items() for story in stories}
expected = {}
pictures = set()
for theme in ("light", "dark"):
    stories = set(scope[theme])
    if theme == "light":
        stories.update(scope["interaction"])
        stories.update(groups)
    for story in stories:
        for width, height in ((390, 844), (1280, 800)):
            stem = f"{story}--{width}x{height}-{theme}"
            expected[stem] = (story, width, height, theme)
            if story in scope[theme]:
                pictures.add(stem)

def inventory(extension, names):
    files = list(root.rglob(f"*--*x*-*.{extension}"))
    found = {file.stem: file for file in files}
    missing = names - found.keys()
    extra = found.keys() - names
    if missing or extra or len(found) != len(files):
        sys.exit(f"{extension} inventory mismatch: missing={sorted(missing)}, extra={sorted(extra)}, files={len(files)}")
    return found

images = inventory("png", pictures)
results = inventory("json", set(expected))
index = []
for stem, (story, width, height, theme) in sorted(expected.items()):
    result = json.loads(results[stem].read_text())
    interaction = theme == "light" and story in scope["interaction"]
    group = groups.get(story) if theme == "light" else None
    if (result["id"], result["width"], result["height"], result["theme"], result["sha"],
        result["interaction"], result.get("group")) != (story, width, height, theme, sha, interaction, group):
        sys.exit(f"Unexpected result in {stem}")
    if group and not result.get("box"):
        sys.exit(f"Missing board measurement in {stem}")
    if stem in images:
        data = images[stem].read_bytes()
        scale = 2 if width == 390 else 1
        if data[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", data[16:24]) != (width * scale, height * scale):
            sys.exit(f"Unexpected image dimensions in {stem}")
        result["image"] = str(images[stem].relative_to(root))
        result["sha256"] = hashlib.sha256(data).hexdigest()
    index.append(result)
(root / "index.json").write_text(json.dumps(index, indent=2) + "\n")
print(f"{sha}: {len(images)} images, {sum(r['interaction'] for r in index)} baseline interaction-log rows, "
      f"{sum(bool(r.get('group')) for r in index)} board measurements; "
      f"{sum(r['interaction'] and r['play'] for r in index)} rows with a declared play function")
