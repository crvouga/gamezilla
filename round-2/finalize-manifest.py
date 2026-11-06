from pathlib import Path
import hashlib,json,subprocess
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
build=json.loads((r/'build-provenance.json').read_text())
capture=json.loads((r/'capture-verdict.json').read_text())
videos=json.loads((r/'journeys/recordings/video-manifest.json').read_text())
runtime=json.loads((r/'interactions/runtime-verdict.json').read_text())
ubuntu=json.loads((r/'ubuntu/verdict.json').read_text())
journeys=json.loads((r/'journeys/mapping.json').read_text())
hashes={}
for directory in ['before','after','pairs','journeys/recordings']:
    for p in sorted((r/directory).rglob('*')):
        if p.is_file():hashes[str(p.relative_to(r))]=hashlib.sha256(p.read_bytes()).hexdigest()
code=hashlib.sha256(json.dumps({'head':head,'build':build['sha256'],'files':hashes},sort_keys=True).encode()).hexdigest()[:16]
status='Hosted verify:end is green on the final revision. Integration remains open: the full local catalog fails the pre-existing /more/troubleshooting statechart-owner gate; two new independent reviews remain pending. '
status+=ubuntu['publicStatus']
assert build['candidateSha']==capture['candidateSha']==runtime['candidateSha']==head
assert all(v['candidateSha']==head for v in videos)
m={'candidateSha':head,'evidence_code':code,'status':'incomplete: full gate and independent reviews remain open',
   'captureRevision':capture['candidateSha'],'buildRevision':build['candidateSha'],'buildSha256':build['sha256'],
   'baselineSha':'90bfe38de0eb0853b9d98e2aec00e88cb8384606','baselineEvidenceCommit':'40b34146d50454f12bf290d19611e6884a4c65de',
   'publicStatus':status,'storyCount':150,'boardFamilies':14,'boardStories':144,'sharedPrimitiveStories':6,
   'stories':json.loads((r/'story-inventory.json').read_text()),'screenshots':600,'beforeScreenshots':528,'pairs':600,
   'absentBeforeImages':capture['missingBefore'],'newStoryCaptureCount':18,'videoCount':38,'videoJourneys':19,
   'testViewports':runtime['viewports'],'galleryViewports':capture['viewports'],'screenshotThemes':['light','dark'],'videoThemes':['light'],
   'hostedChecks':json.loads((r/'interactions/pr-final-status.json').read_text()),
   'runtime':runtime,'ubuntu':ubuntu,'journeys':journeys,'videos':videos,'fileHashes':hashes,
   'evidenceScripts':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in r.iterdir() if p.suffix in ['.sh','.py','.mjs']},
   'reviews':{'status':'pending two independent NEW reviews by parent','ratingsAssigned':False},
   'manualQA':False,'merged':False,
   'limits':['Axe result covers serious/critical violations, not every assistive technology.',
             'Local pixel checks were not accepted on macOS.',
             'Videos exercise Storybook production-rule fixtures; per-board transport/persistence limits remain in journeys/mapping.json.',
             'Full verification stopped at the unrelated pre-existing statechart-owner gate; unexecuted catalog tasks are not passes.']}
(r/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print(head,code,len(hashes),'hashed media files')
