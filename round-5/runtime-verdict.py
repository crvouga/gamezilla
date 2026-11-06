from pathlib import Path
import json,subprocess,collections
r=Path(__file__).parent;head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
cases=json.loads((r/'interactions/browser-classification.json').read_text())['cases']
inventory=json.loads((r/'story-inventory.json').read_text())
titles={c['title'] for c in cases}
missing=[f"{s['id']} {theme}{suffix}" for s in inventory for theme in ['light','dark'] for suffix in ['', '-1440'] if f"{s['id']} {theme}{suffix}" not in titles]
assert not missing, missing
functional=[c for c in cases if c['kind']=='interaction-or-accessibility']
assert not functional,[(c['title'],c['errors']) for c in functional]
font=[c for c in cases if 'font readiness' in c['title']]
instrumented=[c for c in cases if 'instrumented chess geometry' in c['title']]
visual=[c for c in cases if c not in font and c not in instrumented]
assert len(font)==8 and all(c['kind']=='pass' for c in font)
assert len(instrumented)==1 and instrumented[0]['kind']=='pass'
v={'candidateSha':head,'cases':len(cases),'visualCases':len(visual),'fontCases':len(font),
'nativeReadinessPlayBrowserErrorsAxe':{'passed':len(visual),'failed':0},'fontChecks':{'passed':8,'failed':0},
'instrumentedGeometryRegression':{'passed':1,'failed':0},'pixels':dict(collections.Counter(c['kind'] for c in visual)),
'sharedReferencesAcceptedOnMacOS':False,'viewports':[{'width':390,'height':844},{'width':1440,'height':844}],
'command':'sh .overhaul-evidence/ui-ux-overhaul/round-5/test.sh',
'publicStatus':f'All {len(visual)} visual cases passed native readiness/play, browser-error and serious/critical axe stages. Eight font checks and the instrumented chess regression passed. Pixel comparisons, full bun verify, hosted safety and Ubuntu reference decisions are reported separately; no macOS references were accepted.'}
v['pixels']['failureKinds']=dict(collections.Counter('missing reference' if any("doesn't exist" in e or 'does not exist' in e for e in c['errors']) else 'pixel difference' for c in visual if c['kind']=='pixel'))
(r/'interactions/runtime-verdict.json').write_text(json.dumps(v,indent=2)+'\n')
stories=json.loads((r/'story-inventory.json').read_text());mapping=json.loads((r/'journeys/mapping.json').read_text())
for row in mapping:
 prefix=row['stories'][0].split('--')[0]+'--'
 row['stories']=[s['id'] for s in stories if s['id'].startswith(prefix)]
 selected=[c for c in visual if c['title'].startswith(prefix)];counts=collections.Counter(c['kind'] for c in selected)
 row['status']=f"{len(selected)} canonical cases passed native readiness/play, browser-error and serious/critical axe. Pixels: {counts['pass']} passed, {counts['pixel']} failed; no macOS acceptance."
 row['finalMatrix']={'cases':len(selected),'interactionAccessibilityFailures':0,'pixelFailures':counts['pixel'],'pixelPasses':counts['pass']}
 row['evidenceCodeRevision']=head
 row['videoStatus']='See exact-head audited video manifest'
 row['ubuntuStatus']='See round-five ubuntu/verdict.json; prior-round references not applied'
(r/'journeys/mapping.json').write_text(json.dumps(mapping,indent=2)+'\n')
print(json.dumps(v,indent=2))
