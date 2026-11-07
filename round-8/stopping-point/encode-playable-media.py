from pathlib import Path
import subprocess,json,hashlib
r=Path(__file__).parent;m=r/'stopping-media';p=m/'manifest.json';data=json.loads(p.read_text());ffmpeg='/Users/chrisvouga/.cache/uv/archive-v0/-gH10BjuFRcDNK1O/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0'
with (r/'interactions/mp4-encode-audit.log').open('w') as log:
 for video in data['videos']:
  source=m/video['file'];target=source.with_suffix('.mp4')
  subprocess.run([ffmpeg,'-hide_banner','-nostdin','-i',str(source),'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-threads','2',str(target)],stdout=log,stderr=subprocess.STDOUT,check=True)
  subprocess.run([ffmpeg,'-hide_banner','-nostdin','-i',str(target),'-f','null','-'],stdout=log,stderr=subprocess.STDOUT,check=True)
  video['playableFile']=target.relative_to(m).as_posix();video['playableSha256']=hashlib.sha256(target.read_bytes()).hexdigest();video['playableDecoded']=True
  print(target.name,flush=True)
data['delivery']='Original WebMs retained. H.264/yuv420p MP4 copies fully decoded and hashed for browser delivery; GitHub serves WebMs as audio/webm.'
data.pop('evidenceCode');data['evidenceCode']=hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()[:16];p.write_text(json.dumps(data,indent=2)+'\n');print(data['evidenceCode'])
