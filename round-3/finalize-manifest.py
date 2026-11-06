from pathlib import Path
import hashlib,json,subprocess,collections
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
assert not subprocess.check_output(['git','status','--porcelain'],text=True).strip()
build=json.loads((r/'build-provenance.json').read_text())
capture=json.loads((r/'capture-verdict.json').read_text())
videos=json.loads((r/'journeys/recordings/video-manifest.json').read_text())
runtime=json.loads((r/'interactions/runtime-verdict.json').read_text())
ubuntu=json.loads((r/'ubuntu/verdict.json').read_text())
journeys=json.loads((r/'journeys/mapping.json').read_text())
hashes={}
for directory in ['before','after','pairs','journeys/recordings','font-readiness']:
 for p in sorted((r/directory).rglob('*')):
  if p.is_file():hashes[str(p.relative_to(r))]=hashlib.sha256(p.read_bytes()).hexdigest()
code=hashlib.sha256(json.dumps({'head':head,'build':build['sha256'],'files':hashes},sort_keys=True).encode()).hexdigest()[:16]
assert build['candidateSha']==capture['candidateSha']==runtime['candidateSha']==head
assert all(v['candidateSha']==head for v in videos)
stories=json.loads((r/'story-inventory.json').read_text())
m={'candidateSha':head,'evidence_code':code,'status':'incomplete: see verification and review blockers',
 'captureRevision':capture['candidateSha'],'buildRevision':build['candidateSha'],'buildSha256':build['sha256'],
 'baselineSha':'7580af910457dd99962c231b75ced6da14e681b1','baselineEvidenceCommit':'245f924e5689c5f97f29932a115ad1890859867c',
 'publicStatus':runtime['publicStatus']+' '+ubuntu['publicStatus'],
 'storyCount':len(stories),'boardFamilies':14,'boardStories':sum(s['id'].startswith('screens-') for s in stories),
 'stories':stories,'screenshots':capture['count'],'beforeScreenshots':len(list((r/'before').glob('*.png'))),
 'pairs':len(list((r/'pairs').glob('*.png'))),'absentBeforeImages':capture['missingBefore'],
 'videoCount':len(videos),'videoJourneys':len(videos)//2,'testViewports':runtime['viewports'],
 'galleryViewports':capture['viewports'],'screenshotThemes':['light','dark'],'videoThemes':['light'],
 'hostedChecks':json.loads((r/'interactions/pr-final-status.json').read_text()),'runtime':runtime,'ubuntu':ubuntu,
 'journeys':journeys,'videos':videos,'fileHashes':hashes,
 'evidenceScripts':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in r.iterdir() if p.suffix in ['.sh','.py','.mjs']},
 'reviews':{'status':'pending two independent NEW Codex reviews by parent','ratingsAssigned':False},
 'manualQA':False,'merged':False,
 'limits':['Axe covers serious/critical violations, not every assistive technology.',
 'No macOS references were accepted.',
 'Videos use Storybook production-rule fixtures; intrinsic per-board limits are in journeys/mapping.json. No live transport or persistence claim.',
 'A full catalog failure is not a pass; hosted safety results are reported separately.']}
(r/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print(head,code,len(hashes),'hashed media files')
