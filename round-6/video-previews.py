from pathlib import Path
from PIL import Image
import subprocess,tempfile,json,hashlib
r=Path(__file__).parent/'journeys/recordings'
ffmpeg='/Users/chrisvouga/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac'
previews=[]
for p in sorted((r/'videos').glob('*--phone--light.webm')):
 with tempfile.TemporaryDirectory(prefix='round-six-video-') as d:
  subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-i',str(p),'-vf','scale=320:-1','-r','2','-fps_mode','cfr','-c:v','png',str(Path(d)/'%05d.png')],check=True)
  frames=[Image.open(f).convert('RGB').quantize(colors=128) for f in sorted(Path(d).glob('*.png'))]
  assert len(frames)>=2
  out=r/(p.stem+'.gif');frames[0].save(out,save_all=True,append_images=frames[1:],duration=500,loop=0,optimize=False)
  previews.append({'file':out.name,'sourceVideo':str(p.relative_to(r)),'frames':len(frames),'fps':2,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()})
  print(out.name,len(frames),flush=True)
(r/'animated-previews.json').write_text(json.dumps(previews,indent=2)+'\n')
