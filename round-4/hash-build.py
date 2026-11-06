from pathlib import Path
import json,hashlib,subprocess,re
r=Path(__file__).parent;b=Path('pkgs/ui-root-harness-ts/.cache/storybook')
h=hashlib.sha256(); files={}
for p in sorted(b.rglob('*')):
 if p.is_file():
  key=str(p.relative_to(b));d=hashlib.sha256(p.read_bytes()).hexdigest();files[key]=d;h.update(key.encode());h.update(bytes.fromhex(d))
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
(r/'build-provenance.json').write_text(json.dumps({'candidateSha':sha,'sha256':h.hexdigest(),'fileHashes':files},indent=2)+'\n')
idx=json.loads((b/'index.json').read_text());pattern=(r/'pattern.txt').read_text().strip()
a=[v for v in idx['entries'].values() if v['type']=='story' and re.search(pattern,v['id'])]
(r/'story-inventory.json').write_text(json.dumps(a,indent=2)+'\n');(r/'board-story-ids.txt').write_text('\n'.join(v['id'] for v in a)+'\n')
print(sha,h.hexdigest(),len(a),'stories')
