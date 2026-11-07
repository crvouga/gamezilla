from pathlib import Path
import hashlib,json,subprocess,urllib.request
r=Path(__file__).parent;pub=json.loads((r/'publication.json').read_text());media=pub['mediaSha'];m=json.loads((r/'manifest.json').read_text());checks=[]
for i,url in enumerate(pub['comments'],1):
 cid=url.rsplit('-',1)[1];c=json.loads(subprocess.check_output(['gh','api',f'repos/crvouga/gamezilla/issues/comments/{cid}'],text=True));expected=(r/f'media-comment-{i}.md').read_text();assert c['body']==expected;assert media in c['body'] and m['evidence_code'] in c['body'];checks.append({'comment':url,'exactBodyMatches':True})
paths=['manifest.json','after/screens-games-word-tiles-board--assign-a-blank--phone--light.png','journeys/recordings/screens-games-word-tiles-board--assign-a-blank--phone--light.gif','journeys/recordings/videos/screens-games-word-tiles-board--assign-a-blank--phone--light.webm']
for path in paths:
 url=f'https://raw.githubusercontent.com/crvouga/gamezilla/{media}/round-7/{path}'
 with urllib.request.urlopen(url) as response:data=response.read()
 digest=hashlib.sha256(data).hexdigest();assert digest==hashlib.sha256((r/path).read_bytes()).hexdigest();checks.append({'url':url,'bytes':len(data),'sha256':digest,'matches':True})
source=json.loads(subprocess.check_output(['gh','pr','view','280','--repo','crvouga/gamezilla','--json','headRefOid,isDraft,state'],text=True));assert source['headRefOid']==m['candidateSha'];assert source['state']=='OPEN'
(r/'publication-verification.json').write_text(json.dumps({'source':source,'mediaSha':media,'checks':checks,'reviews':'two new independent parent reviews pending','referencesAccepted':False},indent=2)+'\n');print('Pinned publication bodies and representative PNG/GIF/WebM bytes verified')
