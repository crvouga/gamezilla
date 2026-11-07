from pathlib import Path
import hashlib,json,struct,subprocess
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
a=json.loads((r/'after/capture.json').read_text())
assert len(a['stories'])==len(json.loads((r/'story-inventory.json').read_text()))
assert len(a['files'])==4*len(a['stories'])
video_count=2*len((r/'video-story-ids.txt').read_text().splitlines())
v={'candidateSha':head,'count':len(a['files']),'storyCount':len(a['stories']),'themes':a['themes'],'viewports':a['viewports'],
   'missingBefore':[p.name for p in sorted((r/'after').glob('*.png')) if not (r/'before'/p.name).exists()],
   'hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((r/'after').glob('*.png'))}}
assert set(v['hashes'])=={p.name for p in (r/'pairs').glob('*.png')}
(r/'capture-verdict.json').write_text(json.dumps(v,indent=2)+'\n')
rec=r/'journeys/recordings';videos=[]
recorded=json.loads((rec/'capture.json').read_text())['files']
assert len(recorded)==video_count
expected={Path(item['file']).stem+'.webm' for item in recorded}
assert len(expected)==video_count
# Playwright also retains page@<id>.webm copies; audit the exact manifest inventory.
for p in sorted(rec/'videos'/name for name in expected):
    b=p.read_bytes();i=b.find(bytes.fromhex('448988'));checks=json.loads((rec/(p.stem+'.checkpoints.json')).read_text())
    assert i>=0 and checks[-1]['phase']=='finished' and all(not c['failures'] for c in checks)
    distinct=len({hashlib.sha256((rec/'checkpoints'/c['file']).read_bytes()).hexdigest() for c in checks})
    assert distinct>=2
    videos.append({'file':'videos/'+p.name,'durationSeconds':struct.unpack('>d',b[i+3:i+11])[0]/1000,
                   'checkpoints':len(checks),'finalPhase':checks[-1]['phase'],'sha256':hashlib.sha256(b).hexdigest(),
                   'distinctCheckpointFrames':distinct,'checkpointFailures':0,'candidateSha':head})
assert len(videos)==video_count
(rec/'video-manifest.json').write_text(json.dumps(videos,indent=2)+'\n')
duplicates=[]
canonical_hashes={v['sha256'] for v in videos}
for p in (rec/'videos').glob('*.webm'):
    if p.name in expected:continue
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    assert digest in canonical_hashes, f'Unaccounted recording: {p.name}'
    duplicates.append({'file':p.name,'sha256':digest,'reason':'byte-identical Playwright saveAs source copy'})
    p.unlink()
(rec/'duplicate-recording-copies.json').write_text(json.dumps(duplicates,indent=2)+'\n')
j=json.loads((r/'journeys/mapping.json').read_text())
for entry in j:entry['evidenceCodeRevision']=head
(r/'journeys/mapping.json').write_text(json.dumps(j,indent=2)+'\n')
lines=['# Automated journey recordings','',f'Source revision: `{head}`. All {video_count} recordings completed native Storybook replay with assertions intact. Recorder-only 350 ms holds pace meaningful frames; read-only scalar geometry checks execute through native next and reuse the preceding frame in the log. Every assertion still executes. No product delays were introduced.','',
       '| Video | Seconds | Checkpoints | Distinct frames |','|---|---:|---:|---:|']
for v in videos:lines.append(f'| [{Path(v["file"]).stem}](recordings/{v["file"]}) | {v["durationSeconds"]:.2f} | {v["checkpoints"]} | {v["distinctCheckpointFrames"]} |')
lines.extend(['','Per-board scope and remaining limits: [mapping.json](mapping.json). Videos use light theme at 390×844 and 1440×900. Both themes are covered by the full screenshot/check matrices. Post-action frames retain the scroll position produced by the automated journey.'])
(r/'journeys/STATUS.md').write_text('\n'.join(lines)+'\n')
print(len(a['files']),'PNGs and pairs;',video_count,'videos audited at',head)
