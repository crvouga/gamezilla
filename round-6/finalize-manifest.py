from pathlib import Path
import hashlib,json,subprocess
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
assert not subprocess.check_output(['git','status','--porcelain'],text=True).strip()
build=json.loads((r/'build-provenance.json').read_text())
capture=json.loads((r/'capture-verdict.json').read_text())
runtime=json.loads((r/'interactions/runtime-verdict.json').read_text())
videos=json.loads((r/'journeys/recordings/video-manifest.json').read_text())
assert build['candidateSha']==capture['candidateSha']==runtime['candidateSha']==head
assert all(v['candidateSha']==head for v in videos)
hashes={str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for d in ['before','after','pairs','journeys/recordings','font-readiness'] for p in sorted((r/d).rglob('*')) if p.is_file()}
code=hashlib.sha256(json.dumps({'head':head,'build':build['sha256'],'files':hashes},sort_keys=True).encode()).hexdigest()[:16]
stories=json.loads((r/'story-inventory.json').read_text());journeys=json.loads((r/'journeys/mapping.json').read_text())
assert len(journeys)==14
m={'candidateSha':head,'evidence_code':code,'status':'incomplete: independent reviews and verification limitations remain',
'captureRevision':head,'buildRevision':head,'buildSha256':build['sha256'],
'baselineSha':'d2ee6467e23b84ffd7b5128fb993a614df68a7d2','baselineEvidenceCommit':'b69dc3f7f93ddd7467c2057b56a974e60178b410',
'publicStatus':runtime['publicStatus'],'checks':json.loads((r/'interactions/check-summary.json').read_text()),'unresolved':['Full local verification fails outside board scope at /more/troubleshooting chart ownership.','Numberlink republication remains unresolved; retained diagnosis, not rerun without repair.','Old visual references differ or are missing; no automatic acceptance.','Full coverage has 328 retained violations.','Independent parent reviews remain pending.'],'referencesAccepted':False,'source':json.loads((r/'source-working-tree.json').read_text()),'boardFamilies':14,'storyCount':len(stories),'stories':stories,
'screenshots':capture['count'],'beforeScreenshots':len(list((r/'before').glob('*.png'))),'pairs':len(list((r/'pairs').glob('*.png'))),'absentBeforeImages':capture['missingBefore'],
'videoCount':len(videos),'videoJourneys':len(videos)//2,'testViewports':runtime['viewports'],'galleryViewports':capture['viewports'],'screenshotThemes':['light','dark'],'videoThemes':['light'],
'runtime':runtime,'ubuntu':json.loads((r/'ubuntu/verdict.json').read_text()),'hostedChecks':json.loads((r/'interactions/pr-final-status.json').read_text()),
'journeys':journeys,'videos':videos,'fileHashes':hashes,
'verificationHashes':{str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((r/'interactions').rglob('*')) if p.is_file()},
'canonicalEvidenceHashes':{str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((r/'ubuntu').rglob('*')) if p.is_file() and not any(x in p.parts for x in ['staged','diagnostics','.git'])},
'evidenceScripts':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in r.iterdir() if p.suffix in ['.sh','.py','.mjs']},
'interactionArtifactIndex':'interactions/ARTIFACT_INDEX.md','interactionArtifactInventory':'interactions/artifact-inventory.json','reviewInputs':'REVIEW_INPUTS.md',
'reviews':{'status':'parent to commission two NEW independent reviews','ratingsAssigned':False},'manualQA':False,'merged':False,
'limits':['Automated recordings use recorder-only pacing, not natural human timing.','No macOS references accepted.','No live transport, persistence or actual app-update claim from board fixtures.','Full catalog failures and hosted safety outcomes remain separate from board outcomes.']}
(r/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print(head,code,len(hashes),'media hashes')
