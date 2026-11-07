from pathlib import Path
import subprocess,json,hashlib
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
build=json.loads((r/'build-provenance.json').read_text())
assert build['candidateSha']==head
static=Path('pkgs/ui-root-harness-ts/.cache/storybook')
assert {str(p.relative_to(static)):hashlib.sha256(p.read_bytes()).hexdigest() for p in static.rglob('*') if p.is_file()}==build['fileHashes'], 'Static build changed after native binding'
outcomes=[]
for name,command in [('capture',['sh',str(r/'capture.sh')]),('compose',['sh',str(r/'compose.sh')]),('videos',['sh',str(r/'videos.sh')]),('audit-media',['python3',str(r/'audit-media.py')]),('video-previews',['uv','run','--with','pillow','python',str(r/'video-previews.py')]),('gallery',['python3',str(r/'gallery.py')])]:
 print('Starting',name,flush=True)
 with (r/'interactions'/f'{name}.log').open('w') as log: result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
 outcomes.append({'name':name,'command':command,'candidateSha':head,'exitCode':result.returncode})
 (r/'interactions/media-outcomes.json').write_text(json.dumps(outcomes,indent=2)+'\n')
 print('Completed',name,result.returncode,flush=True)
 if result.returncode:raise SystemExit(result.returncode)
