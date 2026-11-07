from pathlib import Path
import hashlib,json
r=Path(__file__).parent
rows=[]
for p in sorted((r/'interactions').rglob('*')):
 if not p.is_file() or p.name in ['ARTIFACT_INDEX.md','artifact-inventory.json']:continue
 rel=p.relative_to(r).as_posix()
 kind='native diagnostic' if 'initial-native' in rel or 'diagnosis' in rel else 'implementation evidence' if '/implementation/' in rel else 'verification output'
 rows.append({'path':rel,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'category':kind})
(r/'interactions/artifact-inventory.json').write_text(json.dumps(rows,indent=2)+'\n')
lines=['# Complete interaction artifact index','',f'{len(rows)} files. Every retained interaction artifact is listed, including failures and diagnostics. Initial-native files belong to the first candidate, not the final native verdict. Refer to HANDOFF.md for verdicts and source bindings.','', '| Artifact | Category | Bytes | SHA-256 |','|---|---|---:|---|']
for x in rows:lines.append(f'| [{x["path"]}]({Path(x["path"]).relative_to("interactions").as_posix()}) | {x["category"]} | {x["bytes"]} | `{x["sha256"]}` |')
(r/'interactions/ARTIFACT_INDEX.md').write_text('\n'.join(lines)+'\n')
print(len(rows),'interaction artifacts indexed')
all_rows=[]
excluded={'WORKING_STATE.md','manifest.json','artifact-inventory.json','ARTIFACT_INDEX.md','HANDOFF.md','publication.json','publication-verification.json','media-commit.txt','handoff-commit.txt'}
for p in sorted(r.rglob('*')):
 if not p.is_file() or p.name in excluded or '__pycache__' in p.parts:continue
 rel=p.relative_to(r).as_posix()
 all_rows.append({'path':rel,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(r/'artifact-inventory.json').write_text(json.dumps(all_rows,indent=2)+'\n')
journey_rows=[x for x in all_rows if x['path'].startswith('journeys/')]
lines=['# Complete journey artifact index','',f'{len(journey_rows)} files, including every assertion checkpoint, JSON sequence, complete video and preview. Checkpoints record automated replay, not human timing.','', '| Artifact | Bytes | SHA-256 |','|---|---:|---|']
for x in journey_rows:lines.append(f'| [{x["path"]}]({Path(x["path"]).relative_to("journeys").as_posix()}) | {x["bytes"]} | `{x["sha256"]}` |')
(r/'journeys/ARTIFACT_INDEX.md').write_text('\n'.join(lines)+'\n')
from collections import Counter
counts=Counter(x['path'].split('/')[0] if '/' in x['path'] else 'root files' for x in all_rows)
lines=['# Round-six artifact audit index','',f'{len(all_rows)} evidence files indexed with exact byte counts and SHA-256 in [artifact-inventory.json](artifact-inventory.json). Publication receipts, this generated index, the final manifest and handoff are excluded from the self-referential file inventory. The manifest separately binds media, checks and scripts.','', '| Group | Files | Audit entry point |','|---|---:|---|']
for name,count in sorted(counts.items()):
 target={'interactions':'interactions/ARTIFACT_INDEX.md','journeys':'journeys/ARTIFACT_INDEX.md','before':'GALLERY.md','after':'GALLERY.md','pairs':'GALLERY.md','font-readiness':'interactions/font-evidence-files.json','ubuntu':'ubuntu/verdict.json'}.get(name,'REVIEW_INPUTS.md')
 lines.append(f'| {name} | {count} | [Index]({target}) |')
lines+=['','Every file under interactions is listed, including unsuccessful or interrupted runs. Every journey checkpoint and recording is listed, rather than only representative screenshots. Per-family coverage and limits are in [journeys/mapping.json](journeys/mapping.json).']
(r/'ARTIFACT_INDEX.md').write_text('\n'.join(lines)+'\n')
print(len(all_rows),'total files;',len(journey_rows),'journey artifacts')
