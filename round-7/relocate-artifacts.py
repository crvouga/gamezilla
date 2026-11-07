from pathlib import Path
import hashlib,json
r=Path(__file__).parent
rows=[]
for root in [*(r/'interactions').rglob('raw-results'),*(r/'interactions').rglob('native-raw-results')]:
 if not root.exists():continue
 for p in sorted(root.rglob('*')):
  if p.is_file():rows.append({'originalPath':'pkgs/ui-root-harness-ts/.cache/storybook-test-results/'+str(p.relative_to(root)),'preservedPath':str(p.relative_to(r)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(r/'interactions/relocated-artifacts.json').write_text(json.dumps(rows,indent=2)+'\n')
print(len(rows),'raw test artifacts mapped from original output paths')
