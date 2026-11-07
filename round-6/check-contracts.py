from pathlib import Path
import json,hashlib,subprocess
r=Path(__file__).parent
p=Path('pkgs/ui-root-harness-ts/.cache/storybook/manifests/components.json')
m=json.loads(p.read_text()); components=m['components']
checks={
 'screens-games-frame-geometry':['board','people','result','next','onPlayBot'],
 'games-battleship-placement-layout':['controls','working','feedback','overview'],
 'components-inputs-paddlecourt':['status','touchHint','halfControl','onTarget'],
 'components-inputs-trailarena':['touchRegions','onDirection'],
 'product-wordtileworkbench':['children'],
 'product-wordtileboard':['purpose','measure','onActivate','cells'],
 'screens-games-sokoban-puzzle':['definition','state','onAction'],
}
for name,props in checks.items():
 c=components[name]
 assert set(props)<=set(c['reactComponentMeta']['props']),name
 assert c['stories'],name
 assert c['description'],name
frame=components['screens-games-frame-geometry']
assert len(frame['stories'])==10
assert all(s.get('description') for s in frame['stories'])
ids={s['id'] for c in components.values() for s in c['stories']}
assert set((r/'board-story-ids.txt').read_text().splitlines())<=ids
out={'candidateSha':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'manifestHash':hashlib.sha256(p.read_bytes()).hexdigest(),'contracts':checks,'sharedFrameStories':10,'status':'passed'}
(r/'interactions/generated-contracts.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
