from pathlib import Path
import hashlib,json,struct,subprocess,shutil
r=Path(__file__).parent;m=r/'stopping-media';head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
assert not subprocess.check_output(['git','status','--porcelain'],text=True).strip()
build=json.loads((r/'build-provenance.json').read_text());assert build['candidateSha']==head
capture=json.loads((m/'after/capture.json').read_text());assert len(capture['files'])==12
images=[]
for p in sorted((m/'after').glob('*.png')):
 dimensions=struct.unpack('>II',p.read_bytes()[16:24]);assert dimensions==((390,844) if '--phone--' in p.name else (1440,900))
 images.append({'file':'after/'+p.name,'width':dimensions[0],'height':dimensions[1],'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 before=r/'before'/p.name
 if before.exists():
  (m/'before').mkdir(exist_ok=True);shutil.copy2(before,m/'before'/p.name)
rec=m/'recordings';files=json.loads((rec/'capture.json').read_text())['files'];assert len(files)==6
videos=[]
for item in files:
 p=rec/'videos'/(Path(item['file']).stem+'.webm');b=p.read_bytes();assert b[:4]==bytes.fromhex('1a45dfa3')
 checks=json.loads((rec/(p.stem+'.checkpoints.json')).read_text());assert checks[-1]['phase']=='finished' and all(not c['failures'] for c in checks)
 distinct=len({hashlib.sha256((rec/'checkpoints'/c['file']).read_bytes()).hexdigest() for c in checks});assert distinct>=2
 pos=b.find(bytes.fromhex('448988'));assert pos>=0
 videos.append({'file':'recordings/videos/'+p.name,'sha256':hashlib.sha256(b).hexdigest(),'seconds':struct.unpack('>d',b[pos+3:pos+11])[0]/1000,'checkpoints':len(checks),'distinctFrames':distinct,'failures':0})
expected={Path(v['file']).name for v in videos};hashes={v['sha256'] for v in videos}
for p in (rec/'videos').glob('*.webm'):
 if p.name not in expected:
  assert hashlib.sha256(p.read_bytes()).hexdigest() in hashes;p.unlink()
manifest={'candidateSha':head,'buildSha256':build['sha256'],'buildSourceSha':build.get('buildSourceSha',head),'sourceDifference':build.get('sourceDifference',[]),'scope':'Three final-candidate journeys only; full-gallery regeneration stopped by user','beforeMediaSha':'f05f61a51cd6961c7e5ae1883d3c9a1e6f384b0d','beforeSourceSha':'b606946642616ea53bbf11e8b4fb23e08fb55c5f','absentBefore':[i['file'] for i in images if not (m/'before'/Path(i['file']).name).exists()],'images':images,'videos':videos,'pacing':'Automated assertion replay, not natural user timing','numberlinkLimit':'Next Puzzle and saving are fixture fidelity, not a persisted-navigation repair','referencesAccepted':False}
manifest['evidenceCode']=hashlib.sha256(json.dumps(manifest,sort_keys=True).encode()).hexdigest()[:16]
(m/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(manifest['evidenceCode'],len(images),'images',len(videos),'videos')
