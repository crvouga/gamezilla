from pathlib import Path
import subprocess,json
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
outcomes=json.loads((r/'interactions/media-outcomes.json').read_text())
for name,command in [('videos-resumed',['sh',str(r/'videos.sh')]),('audit-media',['python3',str(r/'audit-media.py')]),('video-previews',['uv','run','--with','pillow','python',str(r/'video-previews.py')]),('gallery',['python3',str(r/'gallery.py')])]:
 print('Starting',name,flush=True)
 with (r/'interactions'/f'{name}.log').open('w') as log: result=subprocess.run(command,stdout=log,stderr=subprocess.STDOUT)
 outcomes.append({'name':name,'command':command,'candidateSha':head,'exitCode':result.returncode})
 (r/'interactions/media-outcomes.json').write_text(json.dumps(outcomes,indent=2)+'\n')
 print('Completed',name,result.returncode,flush=True)
 if result.returncode:raise SystemExit(result.returncode)
